
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

let projects = [];
let editingId = null;
let isBusy = false;
let loadFailed = false;

function showMessage(text) {
  message.textContent = text;
}

function setBusy(busy) {
  isBusy = busy;

  form.querySelectorAll('input, select, button').forEach(control => {
    control.disabled = busy;
  });

  projectList.querySelectorAll('button').forEach(button => {
    button.disabled = busy;
  });
}

function resetForm() {
  form.reset();
  editingId = null;
  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

function getErrorMessage(data, fallback) {
  if (data && typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  return fallback;
}

async function readResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function renderProjects() {
  projectList.replaceChildren();

  const uniqueProjects = new Map();

  projects.forEach(project => {
    uniqueProjects.set(String(project.id), project);
  });

  projects = Array.from(uniqueProjects.values());

  projects.forEach(project => {
    const listItem = document.createElement('li');
    const projectName = document.createElement('span');
    const projectStatus = document.createElement('span');
    const editButton = document.createElement('button');
    const deleteButton = document.createElement('button');

    projectName.textContent = project.name;
    projectStatus.textContent = ` — Status: ${project.status}`;

    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.disabled = isBusy;

    editButton.addEventListener('click', () => {
      if (isBusy || loadFailed) {
        return;
      }

      const selectedProject = projects.find(
        item => String(item.id) === String(project.id)
      );

      if (!selectedProject) {
        showMessage('Project not found. Please refresh the list.');
        return;
      }

      editingId = selectedProject.id;
      nameInput.value = selectedProject.name;
      statusInput.value = selectedProject.status;

      saveButton.textContent = 'Save changes';
      cancelButton.hidden = false;

      showMessage('Editing project.');
      nameInput.focus();
    });

    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.disabled = isBusy;

    deleteButton.addEventListener('click', async () => {
      if (isBusy || loadFailed) {
        return;
      }

      const selectedProject = projects.find(
        item => String(item.id) === String(project.id)
      );

      if (!selectedProject) {
        showMessage('Project not found. Please refresh the list.');
        return;
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete "${selectedProject.name}"?`
      );

      if (!confirmed) {
        showMessage('Deletion cancelled. No changes were made.');
        return;
      }

      await deleteProject(selectedProject);
    });

    listItem.append(
      projectName,
      projectStatus,
      document.createTextNode(' '),
      editButton,
      document.createTextNode(' '),
      deleteButton
    );

    projectList.appendChild(listItem);
  });

  emptyState.textContent = 'No projects added yet.';
  emptyState.hidden = projects.length > 0;
}

async function loadProjects(options = {}) {
  const keepBusy = options.keepBusy === true;
  const successMessage = options.successMessage || '';

  if (!keepBusy) {
    setBusy(true);
    showMessage('Loading projects...');
  }

  try {
    const response = await fetch('/api/projects');
    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          `Could not load projects (HTTP ${response.status}).`
        )
      );
    }

    if (!Array.isArray(data)) {
      throw new Error('The server returned an invalid project list.');
    }

    const validProjects = data.every(project =>
      project !== null &&
      typeof project === 'object' &&
      !Array.isArray(project) &&
      project.id !== undefined &&
      project.id !== null &&
      String(project.id).trim() !== '' &&
      typeof project.name === 'string' &&
      typeof project.status === 'string' &&
      ['Planned', 'In Progress', 'Completed'].includes(project.status)
    );

    if (!validProjects) {
      throw new Error('The server returned invalid project data.');
    }

    const uniqueProjects = new Map();

    data.forEach(project => {
      uniqueProjects.set(String(project.id), project);
    });

    projects = Array.from(uniqueProjects.values());
    loadFailed = false;

    if (
      editingId !== null &&
      !projects.some(project => String(project.id) === String(editingId))
    ) {
      resetForm();
      renderProjects();
      showMessage('The project being edited no longer exists.');
    } else {
      renderProjects();

      if (successMessage) {
        showMessage(successMessage);
      } else if (projects.length === 0) {
        showMessage('No projects found.');
      } else {
        showMessage('Projects loaded successfully.');
      }
    }

    return true;
  } catch (error) {
    loadFailed = true;
    projects = [];
    projectList.replaceChildren();

    // A failed load is an error, not an empty project collection.
    emptyState.hidden = true;

    const prefix = successMessage
      ? `${successMessage} However, the project list could not be refreshed. `
      : '';

    if (error instanceof TypeError) {
      showMessage(
        `${prefix}Network error: Could not connect to the API. Check that the Express server is running and try again.`
      );
    } else {
      showMessage(`${prefix}${error.message}`);
    }

    return false;
  } finally {
    if (!keepBusy) {
      setBusy(false);
    }
  }
}

async function saveProject(projectData, projectId = null) {
  if (isBusy || loadFailed) {
    showMessage(
      'Projects are not ready. Load the project list successfully before making changes.'
    );
    return;
  }

  setBusy(true);

  showMessage(
    projectId === null
      ? 'Saving new project...'
      : 'Saving project changes...'
  );

  const isEditing = projectId !== null;
  const url = isEditing
    ? `/api/projects/${encodeURIComponent(String(projectId))}`
    : '/api/projects';

  try {
    const response = await fetch(url, {
      method: isEditing ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData)
    });

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          `Could not save the project (HTTP ${response.status}).`
        )
      );
    }

    // The save succeeded. Reset only after the server confirms it.
    resetForm();

    const successText = isEditing
      ? 'Project updated successfully.'
      : 'Project created successfully.';

    const refreshed = await loadProjects({
      keepBusy: true,
      successMessage: successText
    });

    if (refreshed) {
      nameInput.focus();
    }
  } catch (error) {
    if (error instanceof TypeError) {
      showMessage(
        'Network error: Could not save the project. Check your connection and try again.'
      );
    } else {
      showMessage(error.message);
    }
  } finally {
    setBusy(false);
  }
}

async function deleteProject(project) {
  if (isBusy || loadFailed) {
    showMessage(
      'Projects are not ready. Load the project list successfully before making changes.'
    );
    return;
  }

  setBusy(true);
  showMessage('Deleting project...');

  try {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(String(project.id))}`,
      {
        method: 'DELETE'
      }
    );

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          `Could not delete the project (HTTP ${response.status}).`
        )
      );
    }

    if (String(editingId) === String(project.id)) {
      resetForm();
    }

    await loadProjects({
      keepBusy: true,
      successMessage: 'Project deleted successfully.'
    });
  } catch (error) {
    if (error instanceof TypeError) {
      showMessage(
        'Network error: Could not delete the project. Check your connection and try again.'
      );
    } else {
      showMessage(error.message);
    }
  } finally {
    setBusy(false);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  if (isBusy || loadFailed) {
    showMessage(
      'Projects are not ready. Load the project list successfully before making changes.'
    );
    return;
  }

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (!name) {
    nameInput.setCustomValidity('Please enter a project name.');
    nameInput.reportValidity();
    nameInput.setCustomValidity('');
    nameInput.focus();
    return;
  }

  if (name.length > 80) {
    showMessage('Project name must not exceed 80 characters.');
    nameInput.focus();
    return;
  }

  if (!['Planned', 'In Progress', 'Completed'].includes(status)) {
    showMessage('Please select a valid project status.');
    statusInput.focus();
    return;
  }

  const projectData = { name, status };
  const projectId = editingId;

  if (
    projectId !== null &&
    !projects.some(project => String(project.id) === String(projectId))
  ) {
    showMessage('Project not found. Please reload the project list.');
    return;
  }

  await saveProject(projectData, projectId);
});

cancelButton.addEventListener('click', () => {
  if (isBusy) {
    return;
  }

  resetForm();
  showMessage('Edit cancelled. No changes were made.');
  nameInput.focus();
});

loadProjects();
