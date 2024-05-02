// interactive carousel
document.addEventListener('DOMContentLoaded', (event) => {
    let currentSlide = 0;
    const slides = document.querySelectorAll('.carousel-images .image');
    const dotsContainer = document.querySelector('.carousel-dots');
    const totalSlides = slides.length;

    // function to create dots
    function createDots() {
        for (let i = 0; i < totalSlides; i++) {
            const dot = document.createElement('div');
            dot.classList.add('carousel-dot');
            dot.addEventListener('click', () => showSlide(i));
            dotsContainer.appendChild(dot);
        }
    }

    function updateDots(index) {
        const dots = document.querySelectorAll('.carousel-dot');
        dots.forEach(dot => dot.classList.remove('active'));
        dots[index].classList.add('active');
    }

    function showSlide(index) {
        slides.forEach(slide => {
            slide.style.display = "none";
            slide.classList.remove("active");
        });

        slides[index].style.display = "block";
        slides[index].classList.add("active");
        updateDots(index);
    }

    function moveSlide(step) {
        currentSlide = (currentSlide + step + totalSlides) % totalSlides;
        showSlide(currentSlide);
    }

    // initialize the carousel
    createDots();
    showSlide(currentSlide);

    // attach click event listeners to buttons
    document.querySelector('.carousel-button.prev').addEventListener('click', () => moveSlide(-1));
    document.querySelector('.carousel-button.next').addEventListener('click', () => moveSlide(1));
});

// toggle navigation menu
const openNavigation = () => {
    const element = document.getElementById("menu-toggle");
    const body = document.body;
    element.classList.toggle("active");
    body.classList.toggle("no-scroll");
}

// filter and search functionality
document.addEventListener('DOMContentLoaded', function() {
    const allFilters = document.querySelectorAll('.selector-item');
    const rosterItems = document.querySelectorAll('.roster-pictures');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const searchInput = document.getElementById('searchInput');
    const searchCloseButton = document.getElementById('searchCloseButton');

    // deactivate other filters in the same category when one is selected
    function deactivateOtherFiltersInSameCategory(selectedFilter) {
        let category = selectedFilter.getAttribute('data-category');
        document.querySelectorAll(`.selector-item[data-category="${category}"]`).forEach(filter => {
            if (filter !== selectedFilter) {
                filter.classList.remove('active');
            }
        });
    }

    // apply filters based on active filters and search input
    function applyFilters() {
        const searchText = searchInput.value.toLowerCase();
        const activeFilters = Array.from(document.querySelectorAll('.selector-item.active'))
            .map(f => f.getAttribute('filter'));

        rosterItems.forEach(item => {
            const itemFilters = Array.from(item.querySelectorAll('img')).reduce((acc, img) => {
                acc.push(...img.className.split(' '), img.alt.toLowerCase());
                return acc;
            }, []);

            const weaponType = item.getAttribute('data-weapon');
            const itemName = item.querySelector('.name').textContent.toLowerCase();
            const isFilterMatch = activeFilters.every(filter => itemFilters.includes(filter.toLowerCase()) || (weaponType && weaponType === filter));
            const isSearchMatch = itemName.includes(searchText);

            if (isFilterMatch && isSearchMatch) {
                item.style.display = "";
            } else {
                item.style.display = "none";
            }
        });
    }

    // add click event listener to filters
    allFilters.forEach(filter => {
        filter.addEventListener('click', function() {
            if (this.classList.contains('active')) {
                this.classList.remove('active');
            } else {
                deactivateOtherFiltersInSameCategory(this);
                this.classList.add('active');
            }
            applyFilters();
        });
    });

    // clear filters button
    clearFiltersBtn.addEventListener('click', function() {
        allFilters.forEach(filter => filter.classList.remove('active'));
        searchInput.value = '';
        applyFilters();
    });

    // search input for dynamic searching
    searchInput.addEventListener('input', applyFilters);

    // search close button
    searchCloseButton.addEventListener('click', function() {
        searchInput.value = '';
        applyFilters();
    });
});

// hide popup message
function closePopup(popupId) {
    document.getElementById(popupId).style.display = 'none';
}

window.onload = function() {
    // check for the existence of the paragraph inside the popup
    const errorMessageElement = document.querySelector('#errorPopup p');
    if (errorMessageElement) {
        // show the popup if there is an error message
        document.getElementById('errorPopup').style.display = 'block';
    }

        // check success message and display the popup if present
        const successMessageElement = document.querySelector('#successPopup p');
        if (successMessageElement && successMessageElement.textContent.trim().length > 0) {
            document.getElementById('successPopup').style.display = 'block';
        }
};

// show popup
function showPopup(popupId) {
    document.getElementById(popupId).style.display = 'block';
}

// close popup
function closePopup(popupId) {
    document.getElementById(popupId).style.display = 'none';
}

// function to confirm logout
function confirmLogout() {
    window.location.href = '/logout';
}

// function to confirm account deletion
function confirmDelete() {
    fetch('/delete-account', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        }
    })
    .catch(error => console.error('Error:', error));
}

// search functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchButton = document.querySelector('.search-button');
    const searchInput = document.getElementById('searchInput');

    searchButton.addEventListener('click', function() {
        const searchTerm = searchInput.value;
        window.location.href = `/search-posts?term=${encodeURIComponent(searchTerm)}`;
    });

    // allow search on pressing Enter key in the search input field
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            searchButton.click();
        }
    });
});