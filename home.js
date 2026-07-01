document.addEventListener('DOMContentLoaded', () => {
    // Select all FAQ question buttons
    const faqQuestions = document.querySelectorAll('.faq-question');

    // Loop through each question button
    faqQuestions.forEach(question => {
        // Add a click event listener to each question
        question.addEventListener('click', () => {
            // Find the closest parent .faq-item to the clicked question
            const faqItem = question.closest('.faq-item');

            // Toggle the 'active' class on the faqItem
            // This will trigger the CSS rules for showing/hiding the answer and rotating the arrow
            faqItem.classList.toggle('active');
        });
    });
});