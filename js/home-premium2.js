/* =========================================================
   Hotel Montecarlo — Premium home (video) interactions
   ========================================================= */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ---------- Año ---------- */
  const year = $('hpYear');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Nav: sombra al hacer scroll ---------- */
  const nav = $('hpNav');
  const onScroll = () => {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Menú móvil ---------- */
  const menuBtn = $('hpMenuBtn');
  const links = $('hpLinks');
  if (menuBtn && links) {
    menuBtn.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', 'Abrir menú');
      });
    });
    document.addEventListener('click', (e) => {
      if (!links.classList.contains('open')) return;
      if (links.contains(e.target) || menuBtn.contains(e.target)) return;
      links.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 960) {
        links.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.hp-reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Nav activo según sección ---------- */
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  const navLinks = Array.from(document.querySelectorAll('.hp-links a[href^="#"]'));
  if ('IntersectionObserver' in window && sections.length && navLinks.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = '#' + entry.target.id;
        navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === id));
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Atractivos (sin video disponible, se mantienen fotos) ---------- */
  const ATTRACTIONS = [
    {
      title: 'Bahía Inglesa',
      desc: 'Esta playa se caracteriza por la transparencia de sus aguas, poco desnivel y escaso oleaje que la han transformado en el centro turístico de verano más concurrido de la tercera región.',
      img: '/images/attractions/Bahia-Inglesa.jpg'
    },
    {
      title: 'Desierto de Atacama',
      desc: 'El desierto más árido del mundo, con sus salares, termas y geisers, grandes minas de cobre y otros minerales, y fértiles quebradas.',
      img: '/images/attractions/desierto-de-atacama.jpg'
    },
    {
      title: 'Volcán Ojos del Salado',
      desc: 'Lugares predilectos para los amantes del deporte y la adrenalina, con espectaculares campos dunares para la práctica de off-road y sandboard.',
      img: '/images/attractions/volcan-ojos-del-Salado.jpg'
    },
    {
      title: 'Parque Nacional Tres Cruces',
      desc: 'A aproximadamente 3800 metros de altura. El Parque Nacional a tres horas de Copiapó viajando en automóvil.',
      img: '/images/attractions/Parque-nacional-3cruces.jpg'
    },
    {
      title: 'Desierto Florido',
      desc: 'Un fenómeno único donde el desierto despierta de su letargo e irrumpe con un manto de flores de diversos colores.',
      img: '/images/attractions/desierto-florido.jpg'
    },
    {
      title: 'Valle de Copiapó',
      desc: 'Los valles cubiertos de parronales forman un escenario único en la región, con un clima acogedor y soleado donde se unen pasado, presente y futuro.',
      img: '/images/attractions/valle-de-copiapo.jpg'
    },
    {
      title: 'Salar de Pedernales',
      desc: 'Enorme extensión de sales, ubicada en una depresión entre montañas. En sus márgenes interiores se forman lagunas de color azul.',
      img: '/images/attractions/Salar-de-Pedernales.jpg'
    },
    {
      title: 'Laguna del Negro Francisco',
      desc: 'Ubicada en el Parque Nacional Nevado Tres Cruces, a 4.000 m.s.n.m., rodeada de parajes y cumbres importantes.',
      img: '/images/attractions/laguna-del-negro-francisco.jpg'
    }
  ];

  const attrImg = $('hpAttrImg');
  const attrTitle = $('hpAttrTitle');
  const attrDesc = $('hpAttrDesc');
  const attrCount = $('hpAttrCount');
  const attrThumbs = $('hpAttrThumbs');
  const attrPrev = $('hpAttrPrev');
  const attrNext = $('hpAttrNext');
  let attrIndex = 0;
  let attrTimer = null;

  function renderAttrThumbs() {
    if (!attrThumbs) return;
    attrThumbs.innerHTML = ATTRACTIONS.map((a, i) => `
      <button type="button" class="hp-attr-thumb${i === 0 ? ' is-active' : ''}" data-index="${i}" aria-label="${a.title}">
        <img src="${a.img}" alt="${a.title}" loading="lazy">
        <span>${a.title}</span>
      </button>`).join('');
    attrThumbs.querySelectorAll('.hp-attr-thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        showAttr(Number(btn.dataset.index));
        restartAttrTimer();
      });
    });
  }

  function showAttr(index) {
    if (!ATTRACTIONS.length || !attrImg) return;
    attrIndex = (index + ATTRACTIONS.length) % ATTRACTIONS.length;
    const a = ATTRACTIONS[attrIndex];

    attrImg.style.opacity = '0';
    const preload = new Image();
    preload.onload = () => {
      attrImg.src = a.img;
      attrImg.alt = a.title;
      attrImg.style.opacity = '1';
    };
    preload.src = a.img;

    if (attrTitle) attrTitle.textContent = a.title;
    if (attrDesc) attrDesc.textContent = a.desc;
    if (attrCount) attrCount.textContent = (attrIndex + 1) + ' / ' + ATTRACTIONS.length;

    if (attrThumbs) {
      attrThumbs.querySelectorAll('.hp-attr-thumb').forEach((btn, i) => {
        btn.classList.toggle('is-active', i === attrIndex);
      });
    }
  }

  function restartAttrTimer() {
    if (attrTimer) clearInterval(attrTimer);
    attrTimer = setInterval(() => showAttr(attrIndex + 1), 6000);
  }

  if (attrImg && attrThumbs) {
    ATTRACTIONS.forEach((a) => { const im = new Image(); im.src = a.img; });
    renderAttrThumbs();
    showAttr(0);
    restartAttrTimer();

    if (attrPrev) attrPrev.addEventListener('click', () => { showAttr(attrIndex - 1); restartAttrTimer(); });
    if (attrNext) attrNext.addEventListener('click', () => { showAttr(attrIndex + 1); restartAttrTimer(); });

    const stage = document.querySelector('.hp-attraction-stage');
    if (stage) {
      stage.addEventListener('mouseenter', () => { if (attrTimer) clearInterval(attrTimer); });
      stage.addEventListener('mouseleave', restartAttrTimer);
    }
  }

  /* ---------- Espacios (carrusel igual a Atractivos) ---------- */
  const SPACES = [
    { title: 'Áreas comunes y familiares', desc: 'Espacios amplios y acogedores pensados para compartir y disfrutar en familia durante tu estadía.', img: '/images/gallery/g01.jpg' },
    { title: 'Patio y zonas de descanso', desc: 'Rincones tranquilos para relajarte y disfrutar del ambiente familiar del hotel.', img: '/images/gallery/g02.jpg' },
    { title: 'Espacios de convivencia', desc: 'Áreas cómodas donde grandes y chicos pueden compartir momentos inolvidables.', img: '/images/gallery/g03.jpg' },
    { title: 'Ambientes acogedores', desc: 'Cada rincón del hotel está diseñado para que te sientas como en casa.', img: '/images/gallery/g04.jpg' },
    { title: 'Áreas verdes y recreación', desc: 'Espacios al aire libre ideales para descansar y disfrutar en familia.', img: '/images/gallery/g05.jpg' },
    { title: 'Comedor y áreas compartidas', desc: 'Lugares pensados para compartir y comenzar el día con comodidad.', img: '/images/gallery/g06.jpg' },
    { title: 'Espacios para toda la familia', desc: 'Ambientes amplios que invitan a la tranquilidad y el descanso.', img: '/images/gallery/g07.jpg' },
    { title: 'Detalles que hacen la diferencia', desc: 'Cuidamos cada espacio para ofrecer una estadía cálida y confortable.', img: '/images/gallery/g08.jpg' },
    { title: 'Rincones del hotel', desc: 'Descubre los distintos ambientes que hacen especial tu visita.', img: '/images/gallery/g09.jpg' },
    { title: 'Confort en cada espacio', desc: 'Áreas comunes diseñadas para tu bienestar y el de tu familia.', img: '/images/gallery/g10.jpg' },
    { title: 'Tu hogar en Caldera', desc: 'Espacios pensados para que vivas una experiencia memorable en el norte de Chile.', img: '/images/gallery/g11.jpg' }
  ];

  const spaceImg = $('hpSpaceImg');
  const spaceTitle = $('hpSpaceTitle');
  const spaceDesc = $('hpSpaceDesc');
  const spaceCount = $('hpSpaceCount');
  const spaceThumbs = $('hpSpaceThumbs');
  const spacePrev = $('hpSpacePrev');
  const spaceNext = $('hpSpaceNext');
  let spaceIndex = 0;
  let spaceTimer = null;

  function renderSpaceThumbs() {
    if (!spaceThumbs) return;
    spaceThumbs.innerHTML = SPACES.map((s, i) => `
      <button type="button" class="hp-attr-thumb${i === 0 ? ' is-active' : ''}" data-index="${i}" aria-label="${s.title}">
        <img src="${s.img}" alt="${s.title}" loading="lazy">
        <span>${s.title}</span>
      </button>`).join('');
    spaceThumbs.querySelectorAll('.hp-attr-thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        showSpace(Number(btn.dataset.index));
        restartSpaceTimer();
      });
    });
  }

  function showSpace(index) {
    if (!SPACES.length || !spaceImg) return;
    spaceIndex = (index + SPACES.length) % SPACES.length;
    const s = SPACES[spaceIndex];

    spaceImg.style.opacity = '0';
    const preload = new Image();
    preload.onload = () => {
      spaceImg.src = s.img;
      spaceImg.alt = s.title;
      spaceImg.style.opacity = '1';
    };
    preload.src = s.img;

    if (spaceTitle) spaceTitle.textContent = s.title;
    if (spaceDesc) spaceDesc.textContent = s.desc;
    if (spaceCount) spaceCount.textContent = (spaceIndex + 1) + ' / ' + SPACES.length;

    if (spaceThumbs) {
      spaceThumbs.querySelectorAll('.hp-attr-thumb').forEach((btn, i) => {
        btn.classList.toggle('is-active', i === spaceIndex);
      });
    }
  }

  function restartSpaceTimer() {
    if (spaceTimer) clearInterval(spaceTimer);
    spaceTimer = setInterval(() => showSpace(spaceIndex + 1), 6000);
  }

  if (spaceImg && spaceThumbs) {
    SPACES.forEach((s) => { const im = new Image(); im.src = s.img; });
    renderSpaceThumbs();
    showSpace(0);
    restartSpaceTimer();

    if (spacePrev) spacePrev.addEventListener('click', () => { showSpace(spaceIndex - 1); restartSpaceTimer(); });
    if (spaceNext) spaceNext.addEventListener('click', () => { showSpace(spaceIndex + 1); restartSpaceTimer(); });

    const spaceStage = document.querySelector('.hp-spaces-carousel .hp-attraction-stage');
    if (spaceStage) {
      spaceStage.addEventListener('mouseenter', () => { if (spaceTimer) clearInterval(spaceTimer); });
      spaceStage.addEventListener('mouseleave', restartSpaceTimer);
    }
  }

  /* ---------- Lightbox galería ---------- */
  const lightbox = $('hpLightbox');
  const lightboxImg = $('hpLightboxImg');
  const lightboxClose = $('hpLightboxClose');

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  /* ---------- Smooth scroll con offset para nav fijo ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 82;
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', id);
    });
  });

})();
