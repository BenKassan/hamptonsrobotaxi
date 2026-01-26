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
})();
