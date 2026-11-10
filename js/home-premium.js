/* =========================================================
   Hotel Montecarlo — Premium home interactions
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

  /* ---------- Atractivos ---------- */
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
    // Precarga de imágenes
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

  document.querySelectorAll('.hp-gal').forEach((fig) => {
    fig.addEventListener('click', () => {
      const img = fig.querySelector('img');
      openLightbox(fig.dataset.full || (img && img.src), img ? img.alt : '');
    });
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'ArrowRight' && attrNext) { showAttr(attrIndex + 1); restartAttrTimer(); }
    if (e.key === 'ArrowLeft' && attrPrev) { showAttr(attrIndex - 1); restartAttrTimer(); }
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
