/* Skaha Lake Pharmacy: small progressive enhancements. Everything works without it. */
(() => {
  const root = document.documentElement;

  /* Header: stronger shadow once the page scrolls ------------------------- */
  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Home: reveal the nav logo once the big hero logo scrolls under the header */
  const heroLogo = document.querySelector('[data-hero-logo]');
  if (header && heroLogo && 'IntersectionObserver' in window) {
    header.classList.add('has-hero-logo');
    new IntersectionObserver(
      ([entry]) => header.classList.toggle('show-logo', !entry.isIntersecting),
      { rootMargin: '-96px 0px 0px 0px' }
    ).observe(heroLogo);
  }

  /* Mobile menu ------------------------------------------------------------ */
  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-nav-toggle]');
  if (nav && toggle) {
    nav.querySelectorAll('.nav__drawer-links li').forEach((li, i) => li.style.setProperty('--i', i));

    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    nav.querySelectorAll('.nav__drawer a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 960px)').addEventListener('change', (e) => e.matches && setOpen(false));
  }

  /* Reveal on scroll ------------------------------------------------------- */
  const revealables = document.querySelectorAll('[data-reveal], [data-inview]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        // Elements that enter together get a small stagger.
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry, i) => {
            entry.target.style.setProperty('--i', i);
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* Opening hours: live "open now" status in Penticton time ---------------- */
  // Minutes from midnight, indexed by day of week (0 = Sunday).
  const HOURS = [null, [510, 1020], [510, 1020], [510, 1020], [510, 1020], [510, 1020], [540, 780]];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const pacificNow = () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Vancouver',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
      })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value])
    );
    const date = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
    return { date, minutes: (+parts.hour % 24) * 60 + +parts.minute };
  };

  // BC statutory holidays (the pharmacy is closed on holidays).
  const holidaysFor = (year) => {
    const d = (m, day) => Date.UTC(year, m, day);
    const nthMonday = (m, n) => {
      const first = new Date(d(m, 1)).getUTCDay();
      return d(m, 1 + ((8 - first) % 7) + (n - 1) * 7);
    };
    const mondayBefore = (m, day) => {
      const dow = new Date(d(m, day)).getUTCDay();
      return d(m, day - ((dow + 6) % 7 || 7));
    };
    // Anonymous Gregorian algorithm for Easter Sunday.
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((8 * b + 13) / 25)) / 3) + 15) % 30;
    const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
    const canadaDay = new Date(d(6, 1)).getUTCDay() === 0 ? d(6, 2) : d(6, 1);
    return new Set([
      d(0, 1),                         // New Year's Day
      nthMonday(1, 3),                 // Family Day
      d(easterMonth, easterDay - 2),   // Good Friday
      mondayBefore(4, 25),             // Victoria Day
      canadaDay,                       // Canada Day
      nthMonday(7, 1),                 // British Columbia Day
      nthMonday(8, 1),                 // Labour Day
      d(8, 30),                        // Truth and Reconciliation
      nthMonday(9, 2),                 // Thanksgiving
      d(10, 11),                       // Remembrance Day
      d(11, 25),                       // Christmas Day
    ]);
  };

  const isHoliday = (date) => holidaysFor(date.getUTCFullYear()).has(date.getTime());
  const hoursOn = (date) => (isHoliday(date) ? null : HOURS[date.getUTCDay()]);

  const fmt = (mins) => {
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  };

  const openStatus = () => {
    const { date, minutes } = pacificNow();
    const today = hoursOn(date);
    if (today && minutes >= today[0] && minutes < today[1]) {
      const left = today[1] - minutes;
      return left <= 60
        ? { state: 'soon', text: `Closing soon · ${fmt(today[1])}` }
        : { state: 'open', text: `Open now · until ${fmt(today[1])}` };
    }
    if (today && minutes < today[0]) {
      return { state: 'closed', text: `Opens today at ${fmt(today[0])}` };
    }
    for (let i = 1; i <= 7; i++) {
      const next = new Date(date.getTime() + i * 864e5);
      const hours = hoursOn(next);
      if (hours) {
        const label = i === 1 ? 'tomorrow' : DAY_NAMES[next.getUTCDay()];
        const prefix = isHoliday(date) ? 'Closed for the holiday' : 'Closed now';
        return { state: 'closed', text: `${prefix} · opens ${label} ${fmt(hours[0])}` };
      }
    }
    return null;
  };

  const renderHours = () => {
    const status = openStatus();
    document.querySelectorAll('[data-open-status]').forEach((el) => {
      if (!status) return;
      el.dataset.state = status.state;
      el.querySelector('[data-open-text]').textContent = status.text;
      el.hidden = false;
    });
    const { date } = pacificNow();
    const dow = String(isHoliday(date) ? 0 : date.getUTCDay());
    document.querySelectorAll('.hours__row').forEach((row) => {
      row.classList.toggle('is-today', row.dataset.days.split(',').includes(dow));
    });
  };

  renderHours();
  setInterval(renderHours, 60 * 1000);

  /* Video: load YouTube only when asked (faster page, fewer cookies) ------- */
  document.querySelectorAll('[data-video]').forEach((block) => {
    const button = block.querySelector('[data-video-play]');
    if (!button) return;
    button.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${block.dataset.video}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
      iframe.title = 'How PharmaConnect works';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      block.appendChild(iframe);
      requestAnimationFrame(() => block.classList.add('is-playing'));
      iframe.focus();
    }, { once: true });
  });

  /* Current year in the footer -------------------------------------------- */
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  root.classList.add('is-ready');
})();
