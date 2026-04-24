/* eslint-disable */
/* Shared shell for public pages — nav + footer + lang state */
const { LangCtx, Nav, Footer, Marquee } = window;

function PageShell({ children, active }) {
  const [lang, setLang] = useState(document.documentElement.lang === "ar" ? "ar" : "en");
  const t = (window.DCP_I18N && window.DCP_I18N[lang]) || {};

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("data-lang", lang);
  }, [lang]);

  useEffect(() => {
    const pill = document.getElementById("lang-pill");
    if (!pill) return;
    const h = (e) => { const b = e.target.closest("button"); if (b) setLang(b.dataset.l); };
    pill.addEventListener("click", h);
    return () => pill.removeEventListener("click", h);
  }, []);

  useEffect(() => {
    const pill = document.getElementById("lang-pill");
    if (pill) pill.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.l === lang));
  }, [lang]);

  return (
    <LangCtx.Provider value={{ lang, t }}>
      <Marquee />
      <Nav lang={lang} setLang={setLang} active={active}
        links={[
          { href:"./Pricing.html",   label:"Pricing",   key:"pricing" },
          { href:"./Providers.html", label:"Providers", key:"providers" },
          { href:"./Status.html",    label:"Status",    key:"status" },
          { href:"./About.html",     label:"About",     key:"about" },
          { href:"./Contact.html",   label:"Contact",   key:"contact" },
        ]}
        ctaLabel="Start renting"
      />
      {children}
      <Footer />
    </LangCtx.Provider>
  );
}

window.PageShell = PageShell;
