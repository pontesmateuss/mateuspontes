// Ano do rodapé
const ano = document.getElementById("ano");
if (ano) ano.textContent = new Date().getFullYear();

// Destaca no menu a seção que está na tela
const links = document.querySelectorAll(".nav-list a");
const secoes = [...links]
  .map((a) => document.querySelector(a.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window && secoes.length) {
  const observer = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        links.forEach((a) =>
          a.classList.toggle("is-active", a.getAttribute("href") === `#${entrada.target.id}`)
        );
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  secoes.forEach((s) => observer.observe(s));
}
// Progresso de leitura, atualizado no máximo uma vez por quadro.
const progress = document.querySelector('.reading-progress');
let scrollFrame = 0;
function updateProgress() {
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0})`;
  scrollFrame = 0;
}
function scheduleProgress() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
}
window.addEventListener('scroll', scheduleProgress, { passive: true });
window.addEventListener('resize', scheduleProgress);
window.addEventListener('load', scheduleProgress);
updateProgress();

// O conteúdo permanece visível sem JavaScript ou com movimento reduzido.
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !motionPreference.matches) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('is-pending');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section-head, .about-grid, .project, .skill-group, .contact-card').forEach((element) => {
    // Não ocultar conteúdo que já está na tela ao abrir uma âncora.
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    element.classList.add('reveal', 'is-pending');
    revealObserver.observe(element);
  });
  motionPreference.addEventListener('change', (event) => {
    if (!event.matches) return;
    revealObserver.disconnect();
    document.querySelectorAll('.is-pending').forEach((element) => element.classList.remove('is-pending'));
  });
}
