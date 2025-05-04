/**
 * StayCrest Admin Panel JavaScript
 * Handles user management with RBAC functionalities
 */

// DOM Elements
const userTableBody = document.getElementById('userTableBody');
const userSearch = document.getElementById('userSearch');
const addUserBtn = document.getElementById('addUserBtn');
const userModal = document.getElementById('userModal');
const modalClose = document.getElementById('modalClose');
const userForm = document.getElementById('userForm');
const modalTitle = document.getElementById('modalTitle');
const confirmModal = document.getElementById('confirmModal');
const confirmModalClose = document.getElementById('confirmModalClose');
const confirmMessage = document.getElementById('confirmMessage');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.querySelector('.header__theme-icon');

// Pagination elements
const currentPageEl = document.getElementById('currentPage');
const totalPagesEl = document.getElementById('totalPages');
const prevBtn = document.querySelector('.pagination__btn--prev');
const nextBtn = document.querySelector('.pagination__btn--next');

// State management
let currentPage = 1;
let totalPages = 1;
let currentAction = null;
let actionUserId = null;
let users = [];
let searchQuery = '';
let isEditing = false;
let editingUserId = null;
let token = localStorage.getItem('token') || '';
let currentUser = null;

// Constants
const API_URL = '/api';
const ROLES = ['user', 'moderator', 'admin', 'superadmin'];
const STATUSES = ['active', 'inactive', 'pending'];

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  if (theme === 'dark') {
    themeIcon.textContent = '☀️';
    themeIcon.title = 'Switch to light mode';
  } else {
    themeIcon.textContent = '🌙';
    themeIcon.title = 'Switch to dark mode';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

// User Management API calls
async function fetchUsers(page = 1) {
  try {
    showLoader();
    const response = await fetch(`${API_URL}/admin/users?page=${page}&limit=10&search=${searchQuery}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      handleAuthError();
      return;
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      users = data.data.users;
      currentPage = data.pagination.page;
      totalPages = data.pagination.pages;
      updatePagination();
      renderUsers();
    } else {
      showError('Error fetching users');
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    showError('Network error. Please try again.');
  } finally {
    hideLoader();
  }
}

async function fetchUserDetails(userId) {
  try {
    showLoader();
    const response = await fetch(`${API_URL}/admin/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      handleAuthError();
      return null;
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return data.data.user;
    } else {
      showError('Error fetching user details');
      return null;
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
    showError('Network error. Please try again.');
    return null;
  } finally {
    hideLoader();
  }
}

async function createUser(userData) {
  try {
    showLoader();
    const response = await fetch(`${API_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });
    
    if (response.status === 401) {
      handleAuthError();
      return false;
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      showSuccess('User created successfully');
      fetchUsers(currentPage);
      return true;
    } else {
      showError(data.message || 'Error creating user');
      return false;
    }
  } catch (error) {
    console.error('Error creating user:', error);
    showError('Network error. Please try again.');
    return false;
  } finally {
    hideLoader();
  }
}

async function updateUser(userId, userData) {
  try {
    showLoader();
    const response = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });
    
    if (response.status === 401) {
      handleAuthError();
      return false;
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      showSuccess('User updated successfully');
      fetchUsers(currentPage);
      return true;
    } else {
      showError(data.message || 'Error updating user');
      return false;
    }
  } catch (error) {
    console.error('Error updating user:', error);
    showError('Network error. Please try again.');
    return false;
  } finally {
    hideLoader();
  }
}

async function deleteUser(userId) {
  try {
    showLoader();
    const response = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      handleAuthError();
      return false;
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      showSuccess('User deleted successfully');
      fetchUsers(currentPage);
      return true;
    } else {
      showError(data.message || 'Error deleting user');
      return false;
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    showError('Network error. Please try again.');
    return false;
  } finally {
    hideLoader();
  }
}

async function fetchCurrentUser() {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      handleAuthError();
      return;
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      currentUser = data.data.user;
      updateUIBasedOnPermissions();
    }
  } catch (error) {
    console.error('Error fetching current user:', error);
  }
}

// UI Functions
function renderUsers() {
  if (!userTableBody) return;
  
  userTableBody.innerHTML = '';
  
  if (users.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="6" class="text-center">No users found</td>
    `;
    userTableBody.appendChild(emptyRow);
    return;
  }
  
  users.forEach(user => {
    const row = document.createElement('tr');
    
    // Create status and role badges
    const statusBadge = createStatusBadge(user.isVerified ? 'active' : (user.accountLocked ? 'inactive' : 'pending'));
    const roleBadge = createRoleBadge(user.role);
    
    // Create action buttons based on permissions
    const actionButtons = createActionButtons(user);
    
    row.innerHTML = `
      <td>${user.id.substring(0, 8)}...</td>
      <td>${user.firstName} ${user.lastName}</td>
      <td>${user.email}</td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="user-actions">
          ${actionButtons}
        </div>
      </td>
    `;
    
    userTableBody.appendChild(row);
  });
}

function createStatusBadge(status) {
  return `<span class="status-badge status-badge--${status}">${status}</span>`;
}

function createRoleBadge(role) {
  return `<span class="role-badge role-badge--${role}">${role}</span>`;
}

function createActionButtons(user) {
  let buttons = '';
  
  // Edit button - All admins can see this
  buttons += `<button class="user-action-btn user-action-btn--edit" data-user-id="${user.id}" title="Edit user">✏️</button>`;
  
  // Delete button - Only show if appropriate
  if (canDeleteUser(user)) {
    buttons += `<button class="user-action-btn user-action-btn--delete" data-user-id="${user.id}" title="Delete user">🗑️</button>`;
  }
  
  return buttons;
}

function canDeleteUser(user) {
  // Current user can't delete themselves
  if (currentUser && user.id === currentUser.id) {
    return false;
  }
  
  // Only superadmin can delete other admins/superadmins
  if ((user.role === 'admin' || user.role === 'superadmin') && 
      (!currentUser || currentUser.role !== 'superadmin')) {
    return false;
  }
  
  return true;
}

function updatePagination() {
  if (currentPageEl) currentPageEl.textContent = currentPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;
  
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function showModal(title) {
  modalTitle.textContent = title;
  userModal.classList.add('modal--open');
}

function hideModal() {
  userModal.classList.remove('modal--open');
  userForm.reset();
  isEditing = false;
  editingUserId = null;
}

function showConfirmModal(message, action, userId) {
  confirmMessage.textContent = message;
  confirmModal.classList.add('modal--open');
  currentAction = action;
  actionUserId = userId;
}

function hideConfirmModal() {
  confirmModal.classList.remove('modal--open');
  currentAction = null;
  actionUserId = null;
}

function updateUIBasedOnPermissions() {
  // Only show Add User button for admin and superadmin
  if (addUserBtn) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      addUserBtn.style.display = 'none';
    } else {
      addUserBtn.style.display = 'block';
    }
  }
}

// Form handling
async function handleAddUser() {
  const formData = new FormData(userForm);
  
  const userData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    role: formData.get('role'),
    isVerified: formData.get('status') === 'active',
    accountLocked: formData.get('status') === 'inactive'
  };
  
  // Only include password if provided
  const password = formData.get('password');
  if (password) {
    userData.password = password;
  }
  
  // Create or update user
  let success = false;
  if (isEditing && editingUserId) {
    success = await updateUser(editingUserId, userData);
  } else {
    // Password is required for new users
    if (!password) {
      showError('Password is required for new users');
      return;
    }
    success = await createUser(userData);
  }
  
  if (success) {
    hideModal();
  }
}

// Event handlers
async function handleEditUser(userId) {
  isEditing = true;
  editingUserId = userId;
  showModal('Edit User');
  
  // Clear form while loading
  userForm.reset();
  
  // Fetch user details
  const user = await fetchUserDetails(userId);
  if (!user) return;
  
  // Populate form
  document.getElementById('firstName').value = user.firstName || '';
  document.getElementById('lastName').value = user.lastName || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('role').value = user.role || 'user';
  document.getElementById('status').value = user.isVerified 
    ? 'active' 
    : (user.accountLocked ? 'inactive' : 'pending');
  
  // Password field is optional for editing
  document.getElementById('password').placeholder = 'Leave blank to keep current password';
}

async function handleDeleteUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  
  showConfirmModal(`Are you sure you want to delete user ${user.firstName} ${user.lastName}?`, 'delete', userId);
}

async function executeConfirmedAction() {
  if (currentAction === 'delete' && actionUserId) {
    await deleteUser(actionUserId);
  }
  
  hideConfirmModal();
}

function handleAuthError() {
  localStorage.removeItem('token');
  window.location.href = '/index.html';
}

function showLoader() {
  // Add loader implementation
}

function hideLoader() {
  // Remove loader implementation
}

function showSuccess(message) {
  // Show success message implementation
  console.log('Success:', message);
}

function showError(message) {
  // Show error message implementation
  console.error('Error:', message);
}

// Search functionality
function handleSearch() {
  searchQuery = userSearch.value.trim();
  fetchUsers(1); // Reset to first page
}

// Event listeners
function attachEventListeners() {
  // Theme toggle
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Add user button
  if (addUserBtn) {
    addUserBtn.addEventListener('click', () => {
      isEditing = false;
      editingUserId = null;
      userForm.reset();
      showModal('Add New User');
    });
  }
  
  // Modal close
  if (modalClose) {
    modalClose.addEventListener('click', hideModal);
  }
  
  // Confirm modal close
  if (confirmModalClose) {
    confirmModalClose.addEventListener('click', hideConfirmModal);
  }
  
  if (cancelConfirmBtn) {
    cancelConfirmBtn.addEventListener('click', hideConfirmModal);
  }
  
  if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', executeConfirmedAction);
  }
  
  // Form submission
  if (userForm) {
    userForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAddUser();
    });
  }
  
  // Pagination
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        fetchUsers(currentPage - 1);
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        fetchUsers(currentPage + 1);
      }
    });
  }
  
  // Search
  if (userSearch) {
    userSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });
    
    const searchButton = document.querySelector('.search-button');
    if (searchButton) {
      searchButton.addEventListener('click', handleSearch);
    }
  }
  
  // Delete and edit buttons (using event delegation)
  if (userTableBody) {
    userTableBody.addEventListener('click', (e) => {
      if (e.target.classList.contains('user-action-btn--edit')) {
        const userId = e.target.getAttribute('data-user-id');
        handleEditUser(userId);
      } else if (e.target.classList.contains('user-action-btn--delete')) {
        const userId = e.target.getAttribute('data-user-id');
        handleDeleteUser(userId);
      }
    });
  }
}

// Initialization
function init() {
  initTheme();
  attachEventListeners();
  
  // Check if we have token
  if (!token) {
    window.location.href = '/index.html';
    return;
  }
  
  // Fetch current user to get role
  fetchCurrentUser();
  
  // Initial data fetch
  fetchUsers();
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 