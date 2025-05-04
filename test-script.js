/**
 * Test Script for StayCrest Diagnostic
 * This file tests if external JavaScript is correctly loaded
 */

console.log('External test script loaded successfully');

// Test function that will be called from the main page
window.testExternalFunction = function() {
  // Create a unique ID for verification
  const uniqueId = Math.random().toString(36).substring(2, 8);
  
  // Log that we were called
  console.log('External function called with ID:', uniqueId);
  
  // Return a success message
  return `External JavaScript loaded successfully! (ID: ${uniqueId})`;
};

// Add a custom event handler
document.addEventListener('DOMContentLoaded', function() {
  console.log('External script: DOMContentLoaded event triggered');
  
  // Add event listener to all buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.05)';
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
    });
  });
}); 