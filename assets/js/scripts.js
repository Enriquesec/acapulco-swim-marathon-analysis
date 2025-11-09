document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('nav a'); // Selecciona todos los enlaces del nav
    const contentDiv = document.getElementById('content'); // Contenedor donde se cargará el contenido
    
    const loadContent = async (targetFile) => {
        try {
            // Usa fetch para cargar el archivo HTML
            const response = await fetch(`./${targetFile}`);
            if (response.ok) {
                const content = await response.text(); // Convierte la respuesta a texto
                contentDiv.innerHTML = content; // Inserta el contenido en el div
                initializeCharts(); // Llama a una función para inicializar los gráficos
                initializeEventListeners(); // Llama a una función para los nuevos listeners
                initializeSwiper(); // Llama a una función para inicializar el carrusel
            } else {
                contentDiv.innerHTML = `<p>Error ${response.status}: No se pudo cargar el contenido.</p>`;
            }
        } catch (error) {
            contentDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        }
    };

    links.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Evita que el navegador siga el enlace
            const targetFile = link.getAttribute('data-target'); // Obtén el archivo HTML a cargar
            loadContent(targetFile);
        });
    });

    // Carga el contenido inicial
    loadContent('inicio.html');
});

async function setupResultsPage() {
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');

    if (!searchInput || !resultsContainer) return;

    try {
        const response = await fetch('./assets/data/results.json');
        const resultsData = await response.json();

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            resultsContainer.innerHTML = ''; // Limpiar resultados anteriores

            if (searchTerm.length < 3) {
                resultsContainer.innerHTML = '<p class="col-span-full text-gray-400">Ingresa al menos 3 letras para buscar...</p>';
                return;
            }

            const filteredResults = resultsData.filter(result => 
                result.name.toLowerCase().includes(searchTerm)
            );

            if (filteredResults.length === 0) {
                resultsContainer.innerHTML = '<p class="col-span-full text-gray-400">No se encontraron resultados para tu búsqueda.</p>';
            } else {
                filteredResults.forEach(result => {
                    const resultCard = `
                        <div class="card">
                            <h3 class="text-xl font-bold text-green-400">${result.year} - ${result.distance}</h3>
                            <p class="text-2xl font-semibold">${result.name}</p>
                            <div class="text-left mt-4">
                                <p><strong>Categoría:</strong> ${result.category}</p>
                                <p><strong>Tiempo:</strong> ${result.time}</p>
                                <p><strong>Posición (Cat):</strong> ${result.position_category}</p>
                                <p><strong>Posición (Gral):</strong> ${result.position_general}</p>
                            </div>
                        </div>
                    `;
                    resultsContainer.innerHTML += resultCard;
                });
            }
        });
    } catch (error) {
        resultsContainer.innerHTML = '<p class="col-span-full text-red-500">Error al cargar los datos de resultados.</p>';
        console.error('Error fetching results data:', error);
    }
}

function initializeEventListeners() {
    const applyFiltersButton = document.getElementById('applyFilters');
    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', () => {
            const edition = document.getElementById('edition').value;
            const gender = document.getElementById('gender').value;
            const category = document.getElementById('category').value;
        
            console.log('Edición seleccionada:', edition);
            console.log('Sexo seleccionado:', gender);
            console.log('Categoría seleccionada:', category);
        
            // Aquí puedes filtrar los datos según los valores seleccionados
        });
    }

    // Configurar la página de resultados si los elementos existen
    setupResultsPage();

    // Añadir listener para el botón de convocatoria en la página de inicio
    const ctaButton = document.querySelector('a[data-target="convocatoria.html"]');
    if (ctaButton) {
        ctaButton.addEventListener('click', (event) => {
            event.preventDefault();
            loadContent(ctaButton.getAttribute('data-target'));
        });
    }
}

function initializeCharts() {
    // El código para inicializar Chart.js que tenías antes va aquí.
    // Esto asegura que los gráficos se creen cada vez que se carga nuevo contenido.
}

function initializeSwiper() {
    const swiperContainer = document.querySelector('.swiper');
    if (swiperContainer) {
        new Swiper(swiperContainer, {
            // Opciones de Swiper
            loop: true, // Para que el carrusel sea infinito
            slidesPerView: 1, // Muestra 1 slide a la vez en móvil
            spaceBetween: 30, // Espacio entre slides
            autoplay: { // Configuración de autoplay
                delay: 3000, // 3 segundos entre cada slide
                disableOnInteraction: false, // No se detiene si el usuario interactúa
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            breakpoints: {
                // Cuando el ancho de la ventana es >= 768px
                768: {
                    slidesPerView: 3, // Muestra 3 slides
                }
            }
        });
    }
}
