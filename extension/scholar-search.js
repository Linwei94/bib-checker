// Only activate when opened from BibTeX Checker (URL has ?bib-checker=1)
if (!new URLSearchParams(location.search).get('bib-checker')) return;

let attempts = 0;

function clickCite() {
  // Scholar Cite buttons have class gs_or_cit (in result rows)
  const citeBtn = document.querySelector('.gs_or_cit');
  if (!citeBtn) {
    if (++attempts < 20) setTimeout(clickCite, 500);
    return;
  }
  citeBtn.click();

  // Wait for the popup to appear, then click BibTeX
  let popupAttempts = 0;
  function clickBibtex() {
    // BibTeX link has scisf=4 in href or text "BibTeX"
    const links = document.querySelectorAll('a[href*="scisf=4"], a[href*="scholar.bib"]');
    if (!links.length) {
      // Also try by text content
      const all = document.querySelectorAll('#gs_cit a, .gs_citi');
      const bib = [...all].find(a => /bibtex/i.test(a.textContent));
      if (bib) { bib.click(); return; }
      if (++popupAttempts < 20) setTimeout(clickBibtex, 300);
      return;
    }
    links[0].click();
  }
  setTimeout(clickBibtex, 700);
}

setTimeout(clickCite, 900);
