
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

const STORAGE_KEY = 'workshop-projects-v1';

let projects = [];
let editingId = null;

function showMessage(text) {
  if (message) {
    message.textContent = text;
  }
}

function isValidProjectArray(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  const ids = new Set();

  return data.every(project => {
    if (
      project === null ||
      typeof project !== 'object' ||
      typeof project.id !== 'string' ||
      project.id.trim() === '' ||
      typeof project.name !== 'string' ||
      project.name.trim() === '' ||
      typeof project.status !== 'string' ||
      !['Planned', 'In Progress', 'Completed'].includes(project.status) ||
      ids.has(project.id)
    ) {
      return false;
    }

    ids.add(project.id);
    return true;
  });
}

function loadProjects() {
  try {
    const storedText = localStorage.getItem(STORAGE_KEY);

    if (storedText === null) {
      projects = [];
      return;
    }

    const storedProjects = JSON.parse(storedText);

    if (!isValidProjectArray(storedProjects)) {
      projects = [];
      showMessage(
        'Saved project data is invalid. Existing stored data has not been overwritten.'
      );
      return;
    }

    projects = storedProjects;
  } catch (error) {
    projects = [];
    showMessage(
      'Could not read saved projects. Browser storage may be unavailable or the saved data may be malformed.'
    );
  }
}

function saveProjects() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(projects)
    );

    showMessage('Changes saved successfully.');
    return true;
  } catch (error) {
    showMessage(
      'Changes could not be saved. Browser storage may be unavailable or full.'
    );
    return false;
  }
}

function resetForm() {
  form.reset();
  editingId = null;
  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

function renderProjects() {
  projectList.replaceChildren();

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

    editButton.addEventListener('click', () => {
      const selectedProject = projects.find(
        item => item.id === project.id
      );

      if (!selectedProject) {
        return;
      }

      editingId = selectedProject.id;
      nameInput.value = selectedProject.name;
      statusInput.value = selectedProject.status;

      saveButton.textContent = 'Save changes';
      cancelButton.hidden = false;
      nameInput.focus();
    });

    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';

    deleteButton.addEventListener('click', () => {
      const selectedProject = projects.find(
        item => item.id === project.id
      );

      if (!selectedProject) {
        return;
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete "${selectedProject.name}"?`
      );

      if (!confirmed) {
        return;
      }

      const projectIndex = projects.findIndex(
        item => item.id === selectedProject.id
      );

      if (projectIndex === -1) {
        return;
      }

      projects.splice(projectIndex, 1);

      if (editingId === selectedProject.id) {
        resetForm();
      }

      renderProjects();
      saveProjects();
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

  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (!name) {
    nameInput.setCustomValidity('Please enter a project name.');
    nameInput.reportValidity();
    nameInput.setCustomValidity('');
    nameInput.focus();
    return;
  }

  if (editingId !== null) {
    const project = projects.find(
      item => item.id === editingId
    );

    if (!project) {
      showMessage('The project being edited could not be found.');
      resetForm();
      renderProjects();
      return;
    }

    project.name = name;
    project.status = status;
  } else {
    projects.push({
      id: crypto.randomUUID(),
      name: name,
      status: status
    });
  }

  resetForm();
  renderProjects();
  saveProjects();
  nameInput.focus();
});

cancelButton.addEventListener('click', () => {
  resetForm();
  nameInput.focus();
});

loadProjects();
renderProjects();

