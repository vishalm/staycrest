/**
 * Theme Toggle Test Script
 * 
 * This script will ensure the theme toggle button functions properly
 * by directly attaching event listeners without relying on modules.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Theme test script loaded');
  
  // Get the theme toggle button
  const themeToggle = document.getElementById('themeToggle');
  
  if (themeToggle) {
    console.log('Found theme toggle button:', themeToggle);
    
    // Add direct click event listener
    themeToggle.addEventListener('click', function() {
      console.log('Theme toggle clicked');
      
      // Get current theme
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      console.log('Current theme:', currentTheme);
      
      // Toggle theme
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      console.log('Switching to theme:', newTheme);
      
      // Apply new theme
      document.documentElement.setAttribute('data-theme', newTheme);
      document.body.classList.toggle('dark-mode', newTheme === 'dark');
      
      // Update theme icon
      const themeIcon = themeToggle.querySelector('.header__theme-icon');
      if (themeIcon) {
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        themeIcon.setAttribute('title', newTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      }
      
      // Store preference
      localStorage.setItem('theme', newTheme);
      
      // Add animation effect
      document.body.classList.add('theme-transition');
      setTimeout(() => {
        document.body.classList.remove('theme-transition');
      }, 500);
    });
    
    console.log('Theme toggle event listener attached');
  } else {
    console.error('Theme toggle button not found!');
  }
  
  // Add listeners to other buttons for testing
  const allButtons = document.querySelectorAll('button');
  console.log('Found', allButtons.length, 'buttons');
  
  allButtons.forEach((button, index) => {
    button.addEventListener('click', function(e) {
      console.log(`Button clicked: ${button.textContent.trim() || button.id || 'unnamed button ' + index}`);
    });
  });
}); 