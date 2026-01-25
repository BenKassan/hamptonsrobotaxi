(() => {
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (nav) {
        const onScroll = () => {
            nav.classList.toggle('scrolled', window.scrollY > 24);
        };
        onScroll();
        window.addEventListener('scroll', onScroll);
    }

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    const revealTargets = document.querySelectorAll('[data-reveal]');
    if (revealTargets.length) {
        revealTargets.forEach((el, index) => {
            const delay = Math.min(index * 0.04, 0.4);
            el.style.setProperty('--delay', `${delay}s`);
        });
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    const fills = entry.target.querySelectorAll('.progress-fill[data-progress]');
                    fills.forEach((fill) => {
                        fill.style.width = `${fill.dataset.progress}%`;
                    });
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        revealTargets.forEach((el) => observer.observe(el));
    }

    const inquirySelect = document.getElementById('inquiry-type');
    if (inquirySelect) {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');
        if (type) {
            inquirySelect.value = type;
        }
    }
})();
