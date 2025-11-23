document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('nav a[data-target]'); // Selecciona todos los enlaces del nav
    const navContainer = document.getElementById('navbar-container');
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

                // Actualizar el estado activo de los enlaces
                links.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('data-target') === targetFile) {
                        link.classList.add('active');
                    }
                });
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

    // Efecto de scroll en la barra de navegación
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navContainer.querySelector('.main-nav').classList.add('scrolled');
        } else {
            navContainer.querySelector('.main-nav').classList.remove('scrolled');
        }
    });

    // Delegación de eventos para botones cargados dinámicamente
    document.addEventListener('click', (event) => {
        // Comprobar si el clic fue en el botón de "Ver Convocatoria Completa"
        if (event.target.matches('a[data-target="convocatoria.html"]')) {
            event.preventDefault();
            loadContent('convocatoria.html');
        }
    });
});

async function setupResultsPage() {
    const searchInput = document.getElementById('searchInput');
    const filterYear = document.getElementById('filterYear');
    const filterDistance = document.getElementById('filterDistance');
    const filterGender = document.getElementById('filterGender');
    const resultsContainer = document.getElementById('resultsContainer');

    if (!searchInput || !resultsContainer) return;

    try {
        const response = await fetch('assets/data/results.json');
        const resultsData = await response.json();

        const filterResults = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedYear = filterYear.value;
            const selectedDistance = filterDistance.value;
            const selectedGender = filterGender.value;

            resultsContainer.innerHTML = ''; // Limpiar resultados anteriores

            // Si no hay filtros activos y el buscador está vacío (o menos de 3 letras), mostrar mensaje inicial
            if (searchTerm.length < 3 && !selectedYear && !selectedDistance && !selectedGender) {
                resultsContainer.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <svg class="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        <p class="text-xl text-gray-400">Comienza tu búsqueda usando los filtros o escribiendo tu nombre.</p>
                    </div>
                `;
                return;
            }

            const filteredResults = resultsData.filter(result => {
                const matchesName = result.name.toLowerCase().includes(searchTerm);
                const matchesYear = selectedYear ? result.year.toString() === selectedYear : true;
                const matchesDistance = selectedDistance ? result.distance === selectedDistance : true;
                const matchesGender = selectedGender ? result.gender === selectedGender : true;

                return matchesName && matchesYear && matchesDistance && matchesGender;
            });

            if (filteredResults.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <p class="text-xl text-gray-400">No se encontraron resultados con los filtros seleccionados.</p>
                    </div>
                `;
            } else {
                filteredResults.forEach(result => {
                    const resultCard = `
                        <div class="card group relative overflow-hidden">
                            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg class="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/>
                                </svg>
                            </div>
                            <div class="relative z-10">
                                <div class="flex justify-between items-start mb-4">
                                    <span class="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-500/30">
                                        ${result.year}
                                    </span>
                                    <span class="text-gray-400 text-sm font-medium">${result.distance}</span>
                                </div>
                                
                                <h3 class="text-2xl font-bold text-white mb-1 group-hover:text-green-400 transition-colors">${result.name}</h3>
                                <p class="text-sm text-blue-400 mb-6">${result.category}</p>
                                
                                <div class="grid grid-cols-3 gap-4 border-t border-gray-700 pt-4">
                                    <div class="text-center">
                                        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Tiempo</p>
                                        <p class="font-mono font-bold text-white">${result.time}</p>
                                    </div>
                                    <div class="text-center border-l border-gray-700">
                                        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Pos. Cat</p>
                                        <p class="font-bold text-green-400">#${result.position_category}</p>
                                    </div>
                                    <div class="text-center border-l border-gray-700">
                                        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Pos. Gral</p>
                                        <p class="font-bold text-white">#${result.position_general}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    resultsContainer.innerHTML += resultCard;
                });
            }
        };

        // Event Listeners
        searchInput.addEventListener('input', filterResults);
        filterYear.addEventListener('change', filterResults);
        filterDistance.addEventListener('change', filterResults);
        filterGender.addEventListener('change', filterResults);

    } catch (error) {
        resultsContainer.innerHTML = '<p class="col-span-full text-red-500 text-center">Error al cargar los datos de resultados. Por favor intenta más tarde.</p>';
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
    initializeLightbox();
}

function initializeLightbox() {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const zoomableImages = document.querySelectorAll('.zoomable');

    if (!modal || !modalImg) return;

    zoomableImages.forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering other clicks
            modal.classList.remove('hidden');
            modalImg.src = img.src;
            // Small delay to allow display:block to apply before transition
            setTimeout(() => {
                modalImg.classList.remove('scale-95');
                modalImg.classList.add('scale-100');
            }, 10);
        });
    });

    // Close modal function is global to be accessible from HTML onclick
    window.closeModal = () => {
        modalImg.classList.remove('scale-100');
        modalImg.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modalImg.src = '';
        }, 300);
    };
}

function initializeCharts() {
    // El código para inicializar Chart.js que tenías antes va aquí.
    // Esto asegura que los gráficos se creen cada vez que se carga nuevo contenido.
}

function initializeSwiper() {
    const swiperContainer = document.querySelector('.swiper');

    // Si la librería Swiper no se ha cargado todavía, espera un poco y vuelve a intentarlo.
    if (typeof Swiper === 'undefined') {
        setTimeout(initializeSwiper, 100); // Reintentar después de 100ms
        return;
    }

    if (swiperContainer) {
        new Swiper(swiperContainer, {
            // Opciones de Swiper
            loop: true, // Para que el carrusel sea infinito
            slidesPerView: 1, // Muestra 1 slide a la vez en móvil
            spaceBetween: 30, // Espacio entre slides
            observer: true, // Detectar cambios en el DOM
            observeParents: true, // Detectar cambios en los padres
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
