(() => {
    // Navigation scroll effect
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (nav) {
        const onScroll = () => {
            nav.classList.toggle('scrolled', window.scrollY > 50);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    // Mobile nav toggle
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            navToggle.textContent = navLinks.classList.contains('active') ? 'Close' : 'Menu';
        });
    }

    // Reveal animations
    const revealTargets = document.querySelectorAll('[data-reveal]');
    if (revealTargets.length) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        });

        revealTargets.forEach((el) => observer.observe(el));

        // Show first section immediately
        const firstSection = document.querySelector('[data-reveal]');
        if (firstSection) {
            setTimeout(() => firstSection.classList.add('is-visible'), 100);
        }
    }

    // Contact form inquiry type from URL
    const inquirySelect = document.getElementById('inquiry-type') || document.querySelector('select[name="inquiry-type"]');
    if (inquirySelect) {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');
        if (type) {
            inquirySelect.value = type;
        }
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ── Staggered text reveal ────────────────────────────────
    document.querySelectorAll('[data-stagger-reveal]').forEach(el => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        let wordIndex = 0;
        textNodes.forEach(node => {
            const words = node.textContent.split(/(\s+)/);
            const fragment = document.createDocumentFragment();
            words.forEach(part => {
                if (part.trim() === '') {
                    fragment.appendChild(document.createTextNode(part));
                } else {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.textContent = part;
                    span.style.transitionDelay = `${wordIndex * 0.1}s`;
                    wordIndex++;
                    fragment.appendChild(span);
                }
            });
            node.parentNode.replaceChild(fragment, node);
        });
    });

    // ── Counter animation ────────────────────────────────────
    const counters = document.querySelectorAll('[data-count-to]');
    if (counters.length) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.counted) {
                    entry.target.dataset.counted = 'true';
                    const target = parseInt(entry.target.dataset.countTo);
                    const prefix = entry.target.dataset.countPrefix || '';
                    const suffix = entry.target.dataset.countSuffix || '';
                    const duration = 2000;
                    const start = performance.now();
                    const startValue = target > 100 ? target - 60 : 0;

                    function tick(now) {
                        const progress = Math.min((now - start) / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        const current = Math.floor(startValue + (target - startValue) * eased);
                        entry.target.textContent = prefix + current + suffix;
                        if (progress < 1) requestAnimationFrame(tick);
                    }
                    requestAnimationFrame(tick);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(el => counterObserver.observe(el));
    }

    // ── Card 3D tilt on hover ────────────────────────────────
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = `translateY(-4px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.transition = 'all 0.3s ease';
        });
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'none';
        });
    });

    // ── Parallax on scroll ───────────────────────────────────
    const parallaxEls = document.querySelectorAll('.big-stat, .label');
    if (parallaxEls.length) {
        window.addEventListener('scroll', () => {
            parallaxEls.forEach(el => {
                const rect = el.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const viewCenter = window.innerHeight / 2;
                const offset = (centerY - viewCenter) * 0.03;
                el.style.transform = `translateY(${offset}px)`;
            });
        }, { passive: true });
    }

})();
