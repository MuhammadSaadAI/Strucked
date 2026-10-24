/**
 * Struked LLC — Main JavaScript
 * Handles: AOS, Navbar scroll, Mobile nav, Scroll-to-top,
 *           Hero bg load, File upload label, Quote form submission
 */

document.addEventListener('DOMContentLoaded', function () {

    // ==========================================
    // 1. AOS (Animate on Scroll) Initialization
    // ==========================================
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 700,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            once: true,
            offset: 80
        });
    }

    // ==========================================
    // 2. Navbar: Scroll Effect
    // ==========================================
    const nav = document.getElementById('siteNav');

    function updateNav() {
        if (!nav) return;
        if (window.scrollY > 60) {
            nav.classList.add('scrolled');
        } else {
            // Only remove scrolled on homepage (pages with hero)
            if (nav.classList.contains('hero-nav')) {
                nav.classList.remove('scrolled');
            }
        }
    }

    // Mark homepage nav to toggle transparency
    if (document.querySelector('.hero')) {
        nav && nav.classList.add('hero-nav');
    } else {
        // Inner pages keep the scrolled (dark) state permanently
        nav && nav.classList.add('scrolled');
    }

    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();

    // ==========================================
    // 3. Mobile Nav Toggle
    // ==========================================
    const navToggle = document.getElementById('navToggle');
    const navMobile = document.getElementById('navMobile');

    if (navToggle && navMobile) {
        navToggle.addEventListener('click', function () {
            const isOpen = navMobile.classList.toggle('open');
            navToggle.classList.toggle('open', isOpen);
            navToggle.setAttribute('aria-expanded', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Close on link click
        navMobile.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMobile.classList.remove('open');
                navToggle.classList.remove('open');
                navToggle.setAttribute('aria-expanded', false);
                document.body.style.overflow = '';
            });
        });
    }

    // ==========================================
    // 4. Hero Background Ken Burns Effect
    // ==========================================
    const heroBg = document.getElementById('heroBg');
    if (heroBg) {
        // Small delay to trigger transition
        setTimeout(() => heroBg.classList.add('loaded'), 100);
    }

    // ==========================================
    // 5. Scroll-to-Top Button
    // ==========================================
    const scrollTopBtn = document.getElementById('scrollTop');

    if (scrollTopBtn) {
        window.addEventListener('scroll', function () {
            scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
        }, { passive: true });

        scrollTopBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ==========================================
    // 6. File Upload Label Update
    // ==========================================
    const drawingsInput = document.getElementById('drawings');
    const fileLabelText = document.getElementById('fileLabelText');

    if (drawingsInput && fileLabelText) {
        drawingsInput.addEventListener('change', function () {
            const files = Array.from(this.files);
            if (files.length === 0) {
                fileLabelText.textContent = 'Click to upload or drag & drop your files here';
            } else if (files.length === 1) {
                fileLabelText.textContent = files[0].name;
            } else {
                fileLabelText.textContent = `${files.length} files selected`;
            }
        });
    }

    // ==========================================
    // 7. Quote Request Form — Client-Side Validation & Submission
    // ==========================================
    const quoteForm = document.getElementById('quoteForm');

    if (quoteForm) {
        const submitBtn = document.getElementById('submitBtn');
        const formMsg = document.getElementById('formMsg');

        // Simple email regex
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        function showMsg(type, text) {
            formMsg.className = `form-msg ${type}`;
            formMsg.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${text}`;
            formMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function clearMsg() {
            formMsg.className = 'form-msg';
            formMsg.textContent = '';
        }

        function setFieldError(field, msg) {
            field.style.borderColor = '#ef4444';
            let err = field.parentNode.querySelector('.field-err');
            if (!err) {
                err = document.createElement('span');
                err.className = 'field-err';
                err.style.cssText = 'color:#dc2626; font-size:0.78rem; margin-top:0.25rem; display:block;';
                field.parentNode.appendChild(err);
            }
            err.textContent = msg;
        }

        function clearFieldErrors() {
            quoteForm.querySelectorAll('.form-control').forEach(f => {
                f.style.borderColor = '';
            });
            quoteForm.querySelectorAll('.field-err').forEach(e => e.remove());
        }

        function validateForm() {
            clearFieldErrors();
            let valid = true;

            const fullName = document.getElementById('fullName');
            const email = document.getElementById('email');
            const phone = document.getElementById('phone');
            const service = document.getElementById('service');
            const projectDetails = document.getElementById('projectDetails');

            if (!fullName.value.trim() || fullName.value.trim().length < 2) {
                setFieldError(fullName, 'Please enter your full name (at least 2 characters).');
                valid = false;
            }

            if (!email.value.trim() || !emailRe.test(email.value.trim())) {
                setFieldError(email, 'Please enter a valid email address.');
                valid = false;
            }

            if (!phone.value.trim() || phone.value.trim().length < 7) {
                setFieldError(phone, 'Please enter a valid phone number.');
                valid = false;
            }

            if (!service.value) {
                setFieldError(service, 'Please select a service.');
                valid = false;
            }

            if (!projectDetails.value.trim() || projectDetails.value.trim().length < 20) {
                setFieldError(projectDetails, 'Please provide more project details (at least 20 characters).');
                valid = false;
            }

            return valid;
        }

        quoteForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            clearMsg();

            if (!validateForm()) {
                showMsg('error', 'Please correct the highlighted fields and try again.');
                return;
            }

            // Build form data (supports file upload)
            const formData = new FormData(quoteForm);

            // Set loading state
            submitBtn.classList.add('btn-loading');
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

            try {
                const response = await fetch('/api/quote', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok && data.status === 'success') {
                    showMsg('success', data.message || 'Your quote request has been submitted successfully! We will contact you soon.');
                    quoteForm.reset();
                    if (fileLabelText) fileLabelText.textContent = 'Click to upload or drag & drop your files here';
                } else {
                    showMsg('error', data.message || 'Something went wrong. Please try again or contact us directly.');
                }
            } catch (err) {
                // Network error — try to show a helpful message
                console.error('Form submission error:', err);
                showMsg('error',
                    'Unable to submit the form at this moment. Please email us directly at ' +
                    '<a href="mailto:info@struked.com" style="color:inherit; font-weight:600;">info@struked.com</a> ' +
                    'or call <a href="tel:+17432492196" style="color:inherit; font-weight:600;">+1 (743) 249-2196</a>.'
                );
            } finally {
                submitBtn.classList.remove('btn-loading');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // ==========================================
    // 8. Smooth Scroll for Anchor Links
    // ==========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href').slice(1);
            const target = document.getElementById(targetId);
            if (target) {
                e.preventDefault();
                const offset = 90;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

});
