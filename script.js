const canvas = document.getElementById('bgParticles');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let w = window.innerWidth, h = window.innerHeight;
    canvas.width = w; canvas.height = h;
    window.addEventListener('resize', () => {
        w = window.innerWidth; h = window.innerHeight;
        canvas.width = w; canvas.height = h;
    });
    const colors = ['#fe91ca', '#d3dbff', '#ffe0f7', '#fff'];
    let particles = Array.from({length: 55}, () => ({
        x: Math.random()*w,
        y: Math.random()*h,
        r: Math.random()*2+1.5,
        dx: (Math.random()-0.5)*0.5,
        dy: (Math.random()-0.5)*0.5,
        c: colors[Math.floor(Math.random()*colors.length)],
        a: Math.random()*0.6+0.3
    }));
    function draw() {
        ctx.clearRect(0,0,w,h);
        for (let p of particles) {
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.r,0,2*Math.PI);
            ctx.fillStyle = p.c;
            ctx.globalAlpha = p.a;
            ctx.shadowColor = p.c;
            ctx.shadowBlur = 18;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            p.x += p.dx; p.y += p.dy;
            if (p.x<0||p.x>w) p.dx*=-1;
            if (p.y<0||p.y>h) p.dy*=-1;
        }
        requestAnimationFrame(draw);
    }
    draw();
}

const API_KEY = '...'; 
const API_BASE = 'https://kinopoiskapiunofficial.tech/api';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const moviesList = document.getElementById('moviesList');
const genreFilter = document.getElementById('genreFilter');
const countryFilter = document.getElementById('countryFilter');
const yearFrom = document.getElementById('yearFrom');
const yearTo = document.getElementById('yearTo');
const ratingFrom = document.getElementById('ratingFrom');
const ratingTo = document.getElementById('ratingTo');
const sortFilter = document.getElementById('sortFilter');
const filterBtn = document.getElementById('filterBtn');
const homeLink = document.getElementById('homeLink');
const paginationDiv = document.getElementById('pagination');

let logoClicks = 0, logoTimer = null;
homeLink.onclick = () => {
    resetFilters();
    loadPopularMovies();
    logoClicks++;
    if(logoTimer) clearTimeout(logoTimer);
    logoTimer = setTimeout(()=>logoClicks=0, 1200);
    if(logoClicks >= 5){
        openModal('<div style="text-align:center;font-size:2rem"><img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" style="max-width:220px;border-radius:24px;"><br>Мяу! Ты нашёл пасхалку 🐾</div>');
        logoClicks = 0;
    }
};
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
const frameModal = document.getElementById('frameModal');
const frameModalImg = document.getElementById('frameModalImg');
const frameModalClose = document.getElementById('frameModalClose');
const framePrev = document.getElementById('framePrev');
const frameNext = document.getElementById('frameNext');

let genres = [];
let countries = [];
let currentStills = [];
let currentFrameIndex = 0;

let currentPage = 1;
let totalPages = 1;
let currentQuery = null;
let showAdult = false;
let lastMovieModalHtml = null;


async function loadFilters() {
    const res = await fetch(`${API_BASE}/v2.2/films/filters`, { headers: { 'X-API-KEY': API_KEY } });
    const data = await res.json();
    genres = data.genres;
    countries = data.countries;
    genres.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.genre;
        genreFilter.appendChild(opt);
    });
    countries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.country;
        countryFilter.appendChild(opt);
    });
}


genreFilter.addEventListener('change', function() {
    const selectedGenre = genreFilter.options[genreFilter.selectedIndex]?.textContent?.toLowerCase();
    if (selectedGenre === 'для взрослых') {
        const isAdult = confirm('Есть ли вам 18 лет?');
        if (!isAdult) {
            genreFilter.value = '';
            alert('Фильмы для взрослых недоступны для просмотра.');
        }
    }
});

function filterAdultMovies(movies) {
    return movies.filter(movie => {
        const genres = (movie.genres || []).map(g => (g.genre || g).toLowerCase());
        if (genres.includes('для взрослых')) {
            return showAdult;
        }
        return true;
    });
}


function renderPagination() {
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    let html = '';
    if (currentPage > 1) {
        html += `<button class="pagination-btn" data-page="${currentPage-1}">Назад</button>`;
    }
    let start = Math.max(1, currentPage-2), end = Math.min(totalPages, currentPage+2);
    if (start > 1) html += `<button class="pagination-btn" data-page="1">1</button>${start>2?'...':''}`;
    for (let i = start; i <= end; i++) {
        html += `<button class="pagination-btn${i===currentPage?' active':''}" data-page="${i}">${i}</button>`;
    }
    if (end < totalPages) html += `${end<totalPages-1?'...':''}<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    if (currentPage < totalPages) {
        html += `<button class="pagination-btn" data-page="${currentPage+1}">Вперёд</button>`;
    }
    paginationDiv.innerHTML = html;
    paginationDiv.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.onclick = () => goToPage(Number(btn.dataset.page));
    });
}

function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    if (currentQuery) {
        if (currentQuery.type === 'search') searchMovies(currentQuery.value, page);
        else if (currentQuery.type === 'filter') filterMovies(page);
        else loadPopularMovies(page);
    } else {
        loadPopularMovies(page);
    }
}


async function loadPopularMovies(page=1) {
    currentQuery = null;
    currentPage = page;
    moviesList.innerHTML = 'Загрузка...';
    const res = await fetch(`${API_BASE}/v2.2/films/top?type=TOP_100_POPULAR_FILMS&page=${page}`, {
        headers: { 'X-API-KEY': API_KEY }
    });
    const data = await res.json();
    let movies = data.films || data.items || [];
    movies = filterAdultMovies(movies);
    showMovies(movies);
    totalPages = data.pagesCount || data.totalPages || 1;
    renderPagination();
}


async function searchMovies(query, page=1) {
    currentQuery = {type: 'search', value: query};
    currentPage = page;
    moviesList.innerHTML = 'Загрузка...';
    const res = await fetch(`${API_BASE}/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}&page=${page}`, {
        headers: { 'X-API-KEY': API_KEY }
    });
    const data = await res.json();
    let movies = data.films || [];
    movies = filterAdultMovies(movies);
    showMovies(movies);
    totalPages = data.pagesCount || data.totalPages || 1;
    renderPagination();
}


async function filterMovies(page=1) {
    currentQuery = {type: 'filter'};
    currentPage = page;
    moviesList.innerHTML = 'Загрузка...';
    let url = `${API_BASE}/v2.2/films?type=ALL&page=${page}`;
    if (genreFilter.value) url += `&genres=${genreFilter.value}`;
    if (countryFilter.value) url += `&countries=${countryFilter.value}`;
    if (yearFrom.value) url += `&yearFrom=${yearFrom.value}`;
    if (yearTo.value) url += `&yearTo=${yearTo.value}`;
    if (ratingFrom.value) url += `&ratingFrom=${ratingFrom.value}`;
    if (ratingTo.value) url += `&ratingTo=${ratingTo.value}`;
    if (sortFilter.value) url += `&order=${sortFilter.value}`;
    
    showAdult = false;
    const selectedGenre = genreFilter.options[genreFilter.selectedIndex]?.textContent?.toLowerCase() || '';
    if (selectedGenre === 'для взрослых') showAdult = true;
    const res = await fetch(url, { headers: { 'X-API-KEY': API_KEY } });
    const data = await res.json();
    let movies = data.items || [];
    movies = filterAdultMovies(movies);
    showMovies(movies);
    totalPages = data.totalPages || data.pagesCount || 1;
    renderPagination();
}

function showMovies(movies) {
    if (!movies.length) {
        moviesList.innerHTML = 'Ничего не найдено.';
        return;
    }
    moviesList.innerHTML = '';
    movies.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        const id = movie.filmId || movie.kinopoiskId || movie.id;
        let rating = movie.ratingKinopoisk || movie.ratingImdb || movie.rating || '-';
        if (typeof rating === 'object' && rating !== null) {
            rating = rating.rating || '-';
        }
        card.innerHTML = `
            <img src="${movie.posterUrlPreview || movie.posterUrl || ''}" alt="Постер">
            <div class="info">
                <div class="title">${movie.nameRu || movie.nameEn || movie.nameOriginal || 'Без названия'}</div>
                <div class="meta">${movie.year || '-'} • ${movie.countries && movie.countries[0] ? movie.countries[0].country || '' : ''}</div>
            </div>
            <div class="rating">${rating !== null && rating !== undefined ? rating : '-'}</div>
        `;
        card.addEventListener('click', () => showMovieDetails(id));
        moviesList.appendChild(card);
    });
}


function openModal(contentHtml) {
    modalContent.innerHTML = contentHtml;
    modalOverlay.style.display = 'flex';
}
function closeModal() {
    modalOverlay.style.display = 'none';
}
modalClose.onclick = closeModal;
modalOverlay.onclick = function(e) {
    if (e.target === modalOverlay) closeModal();
};


function openFrameModal(stills, index) {
    currentStills = stills;
    currentFrameIndex = index;
    updateFrameModal();
    frameModal.style.display = 'flex';
}
function closeFrameModal() {
    frameModal.style.display = 'none';
}
function updateFrameModal() {
    if (!currentStills.length) return;
    frameModalImg.src = currentStills[currentFrameIndex].imageUrl || currentStills[currentFrameIndex].previewUrl;
}
frameModalClose.onclick = closeFrameModal;
framePrev.onclick = function(e) {
    e.stopPropagation();
    if (currentFrameIndex > 0) {
        currentFrameIndex--;
        updateFrameModal();
    }
};
frameNext.onclick = function(e) {
    e.stopPropagation();
    if (currentFrameIndex < currentStills.length - 1) {
        currentFrameIndex++;
        updateFrameModal();
    }
};
frameModal.onclick = function(e) {
    if (e.target === frameModal) closeFrameModal();
};


async function showPersonModal(personId) {
    openModal('<div style="text-align:center;">Загрузка...</div>');
    const res = await fetch(`${API_BASE}/v1/staff/${personId}`, { headers: { 'X-API-KEY': API_KEY } });
    if (!res.ok) {
        openModal('<div style="text-align:center;">Ошибка загрузки информации о персоне.</div>');
        return;
    }
    const person = await res.json();


    const films = person.films || [];

    let filmsHtml = '<h4 style="margin-top:18px;">Фильмография:</h4>';
    if (films.length) {
        filmsHtml += '<ul style="padding-left:18px;">' +
            films.slice(0, 20).map(f =>
                `<li>${f.nameRu || f.nameEn || f.nameOriginal || ''} <span style="color:#aaa;">${f.rating ? '('+f.rating+'★)' : ''}</span></li>`
            ).join('') +
            '</ul>';
    } else {
        filmsHtml += '<div style="color:#aaa;">Нет данных</div>';
    }

    const contentHtml = `
        <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:center;">
            <img src="${person.posterUrl || person.photo}" alt="${person.nameRu || person.nameEn}" style="width:180px;height:240px;object-fit:cover;border-radius:32px;box-shadow:0 2px 18px #fe91ca44;">
            <div style="flex:1;min-width:220px;">
                <h2 style="margin-top:0;background:linear-gradient(90deg,#fe91ca,#d3dbff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2.1rem">${person.nameRu || person.nameEn}</h2>
                <p><b>Профессия:</b> ${person.profession || '-'}</p>
                ${person.birthday ? `<p><b>Дата рождения:</b> ${person.birthday}</p>` : ''}
                ${person.sex ? `<p><b>Пол:</b> ${person.sex === 'MALE' ? 'мужской' : 'женский'}</p>` : ''}
                ${person.death ? `<p><b>Дата смерти:</b> ${person.death}</p>` : ''}
                ${person.spouses && person.spouses.length ? `<p><b>Супруг(а):</b> ${person.spouses.map(s=>s.name).join(', ')}</p>` : ''}
                ${person.facts && person.facts.length ? `<div style="margin-top:10px;"><b>Факты:</b><ul style="padding-left:18px;">${person.facts.slice(0,3).map(f=>`<li>${f}</li>`).join('')}</ul></div>` : ''}
            </div>
        </div>
        ${filmsHtml}
    `;
   
    const contentHtmlWithBack = `
        <button id="backToMovie" style="background:linear-gradient(90deg,#fe91ca,#d3dbff);color:#251f44;font-weight:700;border:none;border-radius:14px;padding:8px 18px;cursor:pointer;margin-bottom:18px;">&#8592; Назад к фильму</button>
        ${contentHtml}
    `;
    openModal(contentHtmlWithBack);

    setTimeout(() => {
        const backBtn = document.getElementById('backToMovie');
        if (backBtn && lastMovieModalHtml) {
            backBtn.onclick = () => {
                openModal(lastMovieModalHtml);
                setTimeout(() => {
                    document.querySelectorAll('.person-photo[data-personid]').forEach(img => {
                        img.onclick = (e) => {
                            e.stopPropagation();
                            const personId = img.getAttribute('data-personid');
                            if (personId) showPersonModal(personId);
                        };
                    });
                }, 50);
            };
        }
    }, 30);
}



async function showMovieDetails(id) {
    openModal('<div style="text-align:center;">Загрузка...</div>');
    
    const res = await fetch(`${API_BASE}/v2.2/films/${id}`, { headers: { 'X-API-KEY': API_KEY } });
    const data = await res.json();
   
    const staffRes = await fetch(`${API_BASE}/v1/staff?filmId=${id}`, { headers: { 'X-API-KEY': API_KEY } });
    const staff = await staffRes.json();
    
    const trailerRes = await fetch(`${API_BASE}/v2.2/films/${id}/videos`, { headers: { 'X-API-KEY': API_KEY } });
    const trailers = await trailerRes.json();
   
    const stillsRes = await fetch(`${API_BASE}/v2.2/films/${id}/images?type=STILL`, { headers: { 'X-API-KEY': API_KEY } });
    const stills = await stillsRes.json();
   
    const reviewsRes = await fetch(`${API_BASE}/v2.2/films/${id}/reviews`, { headers: { 'X-API-KEY': API_KEY } });
    const reviews = await reviewsRes.json();

    const directors = staff.filter(p => p.professionKey === 'DIRECTOR');
    const actors = staff.filter(p => p.professionKey === 'ACTOR').slice(0, 10);

    let directorsHtml = '';
    if (directors.length) {
        directorsHtml = `<div class="person-list">` +
            directors.map(d =>
                `<div class="person-card">
                    <img src="${d.posterUrl || d.photo}" alt="${d.nameRu || d.nameEn}" class="person-photo" data-personid="${d.staffId || d.kinopoiskId}">
                    <div>${d.nameRu || d.nameEn}</div>
                </div>`
            ).join('') +
            `</div>`;
    }
    let actorsHtml = '';
    if (actors.length) {
        actorsHtml = `<div class="person-list">` +
            actors.map(a =>
                `<div class="person-card">
                    <img src="${a.posterUrl || a.photo}" alt="${a.nameRu || a.nameEn}" class="person-photo" data-personid="${a.staffId || a.kinopoiskId}">
                    <div>${a.nameRu || a.nameEn}</div>
                    ${a.description ? `<div class="role">${a.description}</div>` : ''}
                </div>`
            ).join('') +
            `</div>`;
    }


    let trailerHtml = 'Нет трейлеров';
    if (trailers.items && trailers.items.length) {
        trailerHtml = trailers.items.map(trailer => {
            const site = trailer.site ? trailer.site.toUpperCase() : '';
            if (site === 'YOUTUBE') {
                let embedUrl = trailer.url;
                const match = trailer.url.match(/(?:v=|\/embed\/|\.be\/)([\w-]+)/);
                if (match) embedUrl = `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
                return `<iframe width="100%" height="360" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
            }
            if (site === 'RUTUBE') {
                const match = trailer.url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/);
                if (match) {
                    const rutubeId = match[1];
                    return `<div style="height:360px; max-width:800px; min-height:240px;">
                        <iframe width="100%" height="100%" src="https://rutube.ru/play/embed/${rutubeId}" frameborder="0" allow="clipboard-write; autoplay" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>
                    </div>`;
                }
            }
            
            return `<a href="${trailer.url}" target="_blank" style="color:var(--accent);text-decoration:underline;display:block;margin-bottom:10px;">${trailer.name || trailer.url}</a>`;
        }).join('');
    }


    let stillsHtml = 'Нет кадров';
    if (stills.items && stills.items.length) {
        stillsHtml = stills.items.slice(0, 8).map((s, idx) =>
            `<img src="${s.previewUrl}" onclick="openFrameModalFromGlobal(${id}, ${idx})" alt="Кадр">`
        ).join('');
        window[`stills_${id}`] = stills.items;
        window.openFrameModalFromGlobal = function(movieId, idx) {
            openFrameModal(window[`stills_${movieId}`], idx);
        }
    }

 
    const contentHtml = `
        <div style="display:flex;gap:28px;flex-wrap:wrap;">
            <img src="${data.posterUrlPreview}" alt="Постер" style="width:220px;min-width:120px;border-radius:24px;box-shadow:0 2px 18px #fe91ca44;">
            <div style="flex:1;min-width:220px;">
                <h2 style="margin-top:0;background:linear-gradient(90deg,var(--c2),var(--c4));-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2.1rem">${data.nameRu || data.nameEn}</h2>
                <p><b>Год:</b> ${data.year}</p>
                <p><b>Рейтинг:</b> ${data.ratingKinopoisk || '-'}</p>
                <p><b>Жанры:</b> ${data.genres.map(g => g.genre).join(', ')}</p>
                <p><b>Страны:</b> ${data.countries.map(c => c.country).join(', ')}</p>
                <p><b>Описание:</b> ${data.description || '-'}</p>
            </div>
        </div>
        <div class="directors">
            <h3>Режиссёры</h3>
            ${directorsHtml}
        </div>
        <div class="actors">
            <h3>Актёры</h3>
            ${actorsHtml}
        </div>
        <div class="trailer">
            <h3>Трейлер${trailerHtml.includes('iframe') ? 'ы' : ''}</h3>
            ${trailerHtml}
        </div>
        <div class="stills">
            <h3>Кадры</h3>
            ${stillsHtml}
        </div>
        <div class="reviews">
            <h3>Рецензии зрителей</h3>
            ${reviews.items && reviews.items.length ? reviews.items.slice(0, 3).map(r => `
                <div class="review">
                    <b>${r.author}</b> (${r.date}):<br>
                    ${r.description}
                </div>
            `).join('') : 'Нет рецензий'}
        </div>
    `;
    lastMovieModalHtml = contentHtml;
    openModal(contentHtml);

    setTimeout(() => {
        document.querySelectorAll('.person-photo[data-personid]').forEach(img => {
            img.onclick = (e) => {
                e.stopPropagation();
                const personId = img.getAttribute('data-personid');
                if (personId) showPersonModal(personId);
            };
        });
    }, 50);
}


function resetFilters() {
    genreFilter.value = '';
    countryFilter.value = '';
    yearFrom.value = '';
    yearTo.value = '';
    ratingFrom.value = '';
    ratingTo.value = '';
    sortFilter.value = 'RATING';
    searchInput.value = '';
    showAdult = false;
}


searchBtn.onclick = () => {
    if (searchInput.value.trim()) searchMovies(searchInput.value.trim());
};
filterBtn.onclick = () => filterMovies(1);
searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBtn.click();
});

loadFilters();
loadPopularMovies();
