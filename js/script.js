// Menu button interactions
const menuButtons = document.querySelectorAll('.menu-btn');
document.documentElement.requestFullscreen();

menuButtons.forEach(button => {
    button.addEventListener('click', function() {
        const page = this.getAttribute('data-page');

        // Add click animation
        this.style.transform = 'scale(0.98)';

        setTimeout(() => {
            this.style.transform = '';
        }, 150);

        // Placeholder for navigation - will redirect to respective pages later
        console.log(`Navigating to ${page} page...`);
        // Future: window.location.href = `${page}.html`;
    });
});

// Health bar animation on load
window.addEventListener('load', function() {
    const healthBarFill = document.querySelector('.health-bar-fill');
    healthBarFill.style.width = '0%';

    setTimeout(() => {
        healthBarFill.style.transition = 'width 2s cubic-bezier(0.4, 0, 0.2, 1)';
        healthBarFill.style.width = '85%';
    }, 300);
});

// Subtle parallax effect for background
let mouseX = 0;
let mouseY = 0;
let currentX = 0;
let currentY = 0;

document.addEventListener('mousemove', function(e) {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.008;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.008;
});

function animateParallax() {
    currentX += (mouseX - currentX) * 0.1;
    currentY += (mouseY - currentY) * 0.1;

    const bgRays = document.querySelector('.bg-rays');
    const bgParticles = document.querySelector('.bg-particles');

    if (bgRays) {
        bgRays.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }

    if (bgParticles) {
        bgParticles.style.transform = `translate(${currentX * 0.5}px, ${currentY * 0.5}px)`;
    }

    requestAnimationFrame(animateParallax);
}

animateParallax();

// Subtle golden particle effects
function createParticle() {
    const particle = document.createElement('div');
    particle.style.position = 'fixed';
    particle.style.width = Math.random() * 2 + 1 + 'px';
    particle.style.height = particle.style.width;
    particle.style.borderRadius = '50%';
    particle.style.background = 'rgba(255, 215, 0, 0.6)';
    particle.style.left = Math.random() * window.innerWidth + 'px';
    particle.style.top = '-10px';
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '1';
    particle.style.boxShadow = '0 0 8px rgba(255, 215, 0, 0.8)';

    document.body.appendChild(particle);

    const duration = Math.random() * 4000 + 3000;
    const drift = Math.random() * 60 - 30;

    particle.animate([
        {
            transform: 'translate(0, 0) scale(1)',
            opacity: 0
        },
        {
            transform: `translate(${drift}px, ${window.innerHeight * 0.3}px) scale(1)`,
            opacity: 0.8,
            offset: 0.3
        },
        {
            transform: `translate(${drift * 1.5}px, ${window.innerHeight + 10}px) scale(0)`,
            opacity: 0
        }
    ], {
        duration: duration,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }).onfinish = () => {
        particle.remove();
    };
}

// Generate particles periodically (more subtle)
setInterval(createParticle, 600);

// Character frame glow on hover
const characterFrame = document.querySelector('.character-frame');

if (characterFrame) {
    characterFrame.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.3s ease';
        this.style.boxShadow = '0 0 35px rgba(218, 165, 32, 0.8), inset 0 0 40px rgba(0, 0, 0, 0.9)';
        this.style.borderColor = '#FFD700';
    });

    characterFrame.addEventListener('mouseleave', function() {
        this.style.boxShadow = '';
        this.style.borderColor = '';
    });
}