import React, { useState, useEffect } from "react";
import {
  Heart,
  ChevronRight,
  Sunrise,
  Sun,
  Moon,
  Sparkles,
  Users,
  Layers,
  Compass,
  Send,
} from "lucide-react";

/**
 * ImmersionTunnel — Parcours d'immersion totale Blazing Dynasty
 * -----------------------------------------------------------
 * PROPS :
 * - data : contenu personnalisé (voir defaultData). Chaque champ de contenu
 *          (accroche, avantTexte, basculeEtapes[i], journee[i], temoignages[i])
 *          accepte SOIT une simple chaîne de texte, SOIT un objet média :
 *            { type: "texte" | "photo" | "video", text, url, caption }
 *          Si type est "photo" ou "video", `url` est affiché ; `text`/`caption`
 *          sert de légende optionnelle. Aucune contrainte : chaque distributrice
 *          choisit ce qu'elle veut mettre, section par section.
 *
 *          outils[i].details : tableau optionnel de points (string[]) affiché
 *          dans un panneau déplié quand on clique sur "En savoir plus" sous
 *          la carte outil/formation correspondante.
 *
 * - score : optionnel, résultat du diagnostic "Est-ce fait pour moi ?" (0-100).
 *          Si absent, le composant lit `?score=` dans l'URL (cas d'un retour
 *          de redirection depuis le diagnostic). Si toujours absent, la
 *          dernière étape propose de faire le diagnostic.
 *
 * - onLeadSubmit(coordonnees) : callback appelé quand quelqu'un avec un score
 *          <= 50 laisse ses coordonnées pour en discuter avec toi.
 *
 * BRANCHEMENT FIRESTORE (à faire demain) — voir SCHEMA_FIRESTORE.md
 */

const COLORS = {
  midnight: "#171529",
  midnight2: "#221E3B",
  gold: "#C9A55C",
  goldLight: "#E4CE97",
  rosePoudre: "#E7C9C9",
  lilas: "#B9A6D6",
  cream: "#F7F3EC",
};

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=DM+Sans:wght@400;500;700&display=swap');
`;

const defaultData = {
  prenom: "Mélissa",
  accroche: "Et si ta vie ressemblait enfin à ce que tu mérites ?",
  avantTexte:
    "Il y a eu un temps où je me sentais invisible. Où je donnais tout aux autres sans jamais me demander ce que, moi, je voulais vraiment.",
  basculeEtapes: [
    "Un jour, une amie m'a parlé d'un projet. Je n'y croyais pas vraiment.",
    "Je me suis lancée sans prétention, juste pour voir.",
    "Et puis les choses ont commencé à changer. Doucement. Sûrement.",
    "Aujourd'hui, je me reconnais à nouveau. Et je veux transmettre ça.",
  ],
  journee: [
    { heure: "8h", icon: "sunrise", texte: "Un café, un moment pour moi, puis je réponds à mon équipe en toute liberté — depuis chez moi." },
    { heure: "13h", icon: "sun", texte: "Un appel avec une nouvelle distributrice qui a besoin d'être rassurée. C'est là que je me sens utile." },
    { heure: "20h", icon: "moon", texte: "Je prépare un contenu pour demain, ou je ne fais rien du tout — parce que j'en ai le choix." },
  ],
  outils: [
    {
      titre: "L'app Blazing Dynasty",
      texte: "Ton business organisé, tes stats, tes outils, au même endroit.",
      details: [
        "Un tableau de bord pour suivre tes ventes et celles de ton équipe",
        "Des diagnostics prêts à envoyer à tes prospects",
        "Un espace personnel pour organiser tes contacts et tes relances",
      ],
    },
    {
      titre: "Formation Réseaux Sociaux",
      texte: "Apprends à créer du contenu qui attire, sans jamais forcer.",
      details: [
        "Branding personnel : te positionner sans te déguiser",
        "Storytelling : raconter ton parcours pour créer l'identification",
        "Reels et Stories : les formats qui marchent, expliqués pas à pas",
        "Lives : structurer une prise de parole sans stress",
      ],
    },
    {
      titre: "START & CASH",
      texte: "8 vidéos pour tes premières ventes, sans tourner en rond.",
      details: [
        "8 modules courts pour aller droit à l'essentiel",
        "Pensé pour les toutes premières semaines dans l'équipe",
        "Objectif : ta première vente, sans te sentir perdue",
      ],
    },
    {
      titre: "La Roue de l'Équilibre",
      texte: "Un outil pour faire le point sur toi, avant de foncer.",
      details: [
        "Un diagnostic visuel de ton équilibre de vie actuel",
        "Sert de point de départ avant de se lancer dans le projet",
        "Disponible directement dans ton espace Mon Univers",
      ],
    },
  ],
  temoignages: [
    { profil: "Maman", nom: "Camille", texte: "J'ai enfin du temps pour mes enfants ET un revenu à moi." },
    { profil: "Reconversion", nom: "Sarah", texte: "Je pensais que c'était trop tard pour changer de vie. J'avais tort." },
    { profil: "Débutante", nom: "Lina", texte: "Je n'avais jamais rien vendu. L'équipe m'a portée dès le premier jour." },
  ],
  motCle: "RENAISSANCE",
  lienDiagnostic: "/audit-blazing",
  lienInscription: "/inscription",
};

const iconMap = { sunrise: Sunrise, sun: Sun, moon: Moon };

// ---------- Rendu média générique (texte / photo / vidéo) ----------
function MediaBlock({ content, textStyle = {} }) {
  if (!content) return null;
  if (typeof content === "string") {
    return <p style={textStyle}>{content}</p>;
  }
  const { type, text, url, caption } = content;
  if (type === "photo" && url) {
    return (
      <div style={{ marginBottom: 14 }}>
        <img
          src={url}
          alt={caption || ""}
          style={{ width: "100%", borderRadius: 16, objectFit: "cover", maxHeight: 320, display: "block" }}
        />
        {(caption || text) && (
          <p style={{ fontSize: 13, opacity: 0.65, marginTop: 8 }}>{caption || text}</p>
        )}
      </div>
    );
  }
  if (type === "video" && url) {
    return (
      <div style={{ marginBottom: 14 }}>
        <video
          src={url}
          controls
          style={{ width: "100%", borderRadius: 16, maxHeight: 320, display: "block" }}
        />
        {(caption || text) && (
          <p style={{ fontSize: 13, opacity: 0.65, marginTop: 8 }}>{caption || text}</p>
        )}
      </div>
    );
  }
  return <p style={textStyle}>{text}</p>;
}

// ---------- Sous-composants UI ----------
function ProgressBar({ step, total }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: COLORS.midnight, paddingTop: 10, paddingBottom: 6 }}>
      <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 4, overflow: "hidden", margin: "0 20px" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.lilas})`,
            transition: "width 500ms ease",
          }}
        />
      </div>
    </div>
  );
}

function SectionShell({ children, dark = true }) {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "48px 24px",
        background: dark
          ? `linear-gradient(160deg, ${COLORS.midnight}, ${COLORS.midnight2})`
          : COLORS.cream,
        color: dark ? COLORS.cream : COLORS.midnight,
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>{children}</div>
    </section>
  );
}

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: COLORS.gold,
        marginBottom: 14,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, href, style = {} }) {
  const props = href ? { as: "a", href, target: "_blank", rel: "noreferrer" } : {};
  const commonStyle = {
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "0.02em",
    color: COLORS.midnight,
    background: `linear-gradient(90deg, ${COLORS.goldLight}, ${COLORS.gold})`,
    border: "none",
    borderRadius: 999,
    padding: "14px 28px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
    boxShadow: "0 8px 24px rgba(201,165,92,0.25)",
    ...style,
  };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={commonStyle}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} style={commonStyle}>
      {children}
    </button>
  );
}

// ---------- Composant principal ----------
export default function ImmersionTunnel({ data, score: scoreProp, onLeadSubmit }) {
  const d = { ...defaultData, ...(data || {}) };
  const TOTAL_STEPS = 7;
  const [step, setStep] = useState(0);

  const [checked, setChecked] = useState({});
  const avantOptions = [
    "Je me sens fatiguée par mon quotidien",
    "Je cherche un revenu à moi",
    "Je veux plus de liberté dans mon organisation",
    "Je cherche un sens à ce que je fais",
  ];

  const [basculeIndex, setBasculeIndex] = useState(0);
  const [openHeure, setOpenHeure] = useState(null);
  const [openOutil, setOpenOutil] = useState(null);
  const [filtre, setFiltre] = useState("Tous");
  const profils = ["Tous", ...Array.from(new Set(d.temoignages.map((t) => t.profil)))];
  const temoignagesFiltres =
    filtre === "Tous" ? d.temoignages : d.temoignages.filter((t) => t.profil === filtre);

  // Score du diagnostic "Est-ce fait pour moi ?" — soit passé en prop, soit
  // récupéré dans l'URL au retour de la page de diagnostic (?score=68)
  const [score, setScore] = useState(scoreProp ?? null);
  useEffect(() => {
    if (scoreProp != null) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("score");
      if (s !== null) setScore(Number(s));
    } catch (e) {
      /* pas de window (contexte non-navigateur) */
    }
  }, [scoreProp]);

  // Formulaire de coordonnées (score <= 50)
  const [lead, setLead] = useState({ nom: "", email: "", telephone: "" });
  const [leadEnvoye, setLeadEnvoye] = useState(false);
  const soumettreLead = () => {
    onLeadSubmit && onLeadSubmit(lead);
    setLeadEnvoye(true);
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{fontImport}</style>
      <ProgressBar step={step + 1} total={TOTAL_STEPS} />

      {/* 1. Accroche */}
      {step === 0 && (
        <SectionShell>
          <Eyebrow>Immersion Blazing Dynasty</Eyebrow>
          {typeof d.accroche === "string" ? (
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(32px, 6vw, 48px)",
                fontWeight: 600,
                lineHeight: 1.15,
                marginBottom: 24,
              }}
            >
              {d.accroche}
            </h1>
          ) : (
            <div style={{ marginBottom: 24 }}>
              <MediaBlock
                content={d.accroche}
                textStyle={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(28px, 5vw, 40px)",
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              />
            </div>
          )}
          <p style={{ opacity: 0.75, marginBottom: 32, lineHeight: 1.6 }}>
            Une immersion de quelques minutes pour découvrir, de l'intérieur, ce que
            {" "}{d.prenom}{" "}et son équipe vivent au quotidien.
          </p>
          <PrimaryButton onClick={next}>
            <Heart size={16} /> Je démarre l'immersion
          </PrimaryButton>
        </SectionShell>
      )}

      {/* 2. Le Avant */}
      {step === 1 && (
        <SectionShell dark={false}>
          <Eyebrow>Avant</Eyebrow>
          <div style={{ marginBottom: 18 }}>
            <MediaBlock
              content={d.avantTexte}
              textStyle={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, lineHeight: 1.35 }}
            />
          </div>
          <p style={{ opacity: 0.7, marginBottom: 20, fontSize: 14 }}>Coche ce qui te parle :</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {avantOptions.map((opt, i) => (
              <label
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: `1px solid ${checked[i] ? COLORS.gold : "rgba(23,21,41,0.15)"}`,
                  background: checked[i] ? "rgba(201,165,92,0.08)" : "transparent",
                  cursor: "pointer",
                  transition: "all 200ms ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                  style={{ accentColor: COLORS.gold, width: 18, height: 18 }}
                />
                <span style={{ fontSize: 15 }}>{opt}</span>
              </label>
            ))}
          </div>
          <PrimaryButton onClick={next}>
            Continuer <ChevronRight size={16} />
          </PrimaryButton>
        </SectionShell>
      )}

      {/* 3. La bascule */}
      {step === 2 && (
        <SectionShell>
          <Eyebrow>Le déclic</Eyebrow>
          <div
            onClick={() =>
              basculeIndex < d.basculeEtapes.length - 1
                ? setBasculeIndex((i) => i + 1)
                : next()
            }
            style={{ cursor: "pointer" }}
          >
            <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
              {d.basculeEtapes.map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 3,
                    background: i <= basculeIndex ? COLORS.gold : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>
            <div style={{ minHeight: 160 }}>
              <MediaBlock
                content={d.basculeEtapes[basculeIndex]}
                textStyle={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, lineHeight: 1.4 }}
              />
            </div>
            <p style={{ opacity: 0.5, fontSize: 13, marginTop: 24 }}>
              Touche l'écran pour continuer →
            </p>
          </div>
        </SectionShell>
      )}

      {/* 4. Journée type */}
      {step === 3 && (
        <SectionShell dark={false}>
          <Eyebrow>Une journée type</Eyebrow>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, marginBottom: 24 }}>
            Touche une heure pour la découvrir
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {d.journee.map((mom, i) => {
              const Icon = iconMap[mom.icon] || Sun;
              const isOpen = openHeure === i;
              return (
                <div
                  key={i}
                  onClick={() => setOpenHeure(isOpen ? null : i)}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${isOpen ? COLORS.gold : "rgba(23,21,41,0.15)"}`,
                    padding: "16px 18px",
                    cursor: "pointer",
                    background: isOpen ? "rgba(201,165,92,0.06)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Icon size={18} color={COLORS.gold} />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{mom.heure}</span>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 10 }}>
                      <MediaBlock
                        content={mom.media || mom.texte}
                        textStyle={{ fontSize: 14.5, lineHeight: 1.6, opacity: 0.85 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <PrimaryButton onClick={next}>
            Continuer <ChevronRight size={16} />
          </PrimaryButton>
        </SectionShell>
      )}

      {/* 5. Coulisses équipe */}
      {step === 4 && (
        <SectionShell>
          <Eyebrow>Les coulisses</Eyebrow>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, marginBottom: 20 }}>
            Des outils pensés pour toi
          </h2>
          <div
            style={{
              display: "flex",
              gap: 14,
              overflowX: "auto",
              paddingBottom: 12,
              marginBottom: 24,
              scrollSnapType: "x mandatory",
            }}
          >
            {d.outils.map((o, i) => {
              const isOpen = openOutil === i;
              return (
                <div
                  key={i}
                  style={{
                    minWidth: 220,
                    scrollSnapAlign: "start",
                    borderRadius: 18,
                    padding: 20,
                    background: isOpen ? "rgba(201,165,92,0.1)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isOpen ? COLORS.gold : COLORS.lilas + "44"}`,
                    cursor: "pointer",
                  }}
                  onClick={() => setOpenOutil(isOpen ? null : i)}
                >
                  <Layers size={18} color={COLORS.lilas} style={{ marginBottom: 10 }} />
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{o.titre}</div>
                  <div style={{ fontSize: 13.5, opacity: 0.75, lineHeight: 1.5, marginBottom: 10 }}>{o.texte}</div>
                  {o.details && (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.gold }}>
                      {isOpen ? "Réduire ▲" : "En savoir plus ▼"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ opacity: 0.5, fontSize: 13, marginBottom: 20 }}>← Fais glisser pour voir tous les outils →</p>

          {/* Panneau de détails de la formation/outil sélectionné */}
          {openOutil !== null && d.outils[openOutil]?.details && (
            <div
              style={{
                borderRadius: 18,
                padding: 22,
                marginBottom: 24,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${COLORS.gold}55`,
              }}
            >
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, marginBottom: 12 }}>
                {d.outils[openOutil].titre}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {d.outils[openOutil].details.map((ligne, k) => (
                  <li key={k} style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
                    {ligne}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PrimaryButton onClick={next}>
            Continuer <ChevronRight size={16} />
          </PrimaryButton>
        </SectionShell>
      )}

      {/* 6. Témoignages */}
      {step === 5 && (
        <SectionShell dark={false}>
          <Eyebrow>Elles témoignent</Eyebrow>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, marginBottom: 18 }}>
            Trouve celle qui te ressemble
          </h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {profils.map((p) => (
              <button
                key={p}
                onClick={() => setFiltre(p)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1px solid ${filtre === p ? COLORS.gold : "rgba(23,21,41,0.2)"}`,
                  background: filtre === p ? COLORS.gold : "transparent",
                  color: COLORS.midnight,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {temoignagesFiltres.map((t, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 16,
                  padding: 18,
                  background: "rgba(185,166,214,0.08)",
                  border: `1px solid ${COLORS.lilas}55`,
                }}
              >
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: COLORS.lilas, marginBottom: 6, fontWeight: 700 }}>
                  {t.profil} · {t.nom}
                </div>
                <MediaBlock content={t.media || t.texte} textStyle={{ fontSize: 15, lineHeight: 1.55 }} />
              </div>
            ))}
          </div>
          <PrimaryButton onClick={next}>
            Continuer <ChevronRight size={16} />
          </PrimaryButton>
        </SectionShell>
      )}

      {/* 7. Diagnostic + branchement score */}
      {step === 6 && (
        <SectionShell>
          <div style={{ textAlign: "center" }}>
            <Sparkles size={28} color={COLORS.gold} style={{ marginBottom: 16 }} />
            <Eyebrow>Et maintenant ?</Eyebrow>

            {score === null && (
              <>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, marginBottom: 16 }}>
                  Est-ce fait pour toi ?
                </h2>
                <p style={{ opacity: 0.75, marginBottom: 32, lineHeight: 1.6 }}>
                  Réponds à quelques questions pour le savoir vraiment — ça prend deux minutes.
                </p>
                <PrimaryButton href={`${d.lienDiagnostic}?ref=immersion`}>
                  <Compass size={16} /> Je fais le diagnostic
                </PrimaryButton>
              </>
            )}

            {score !== null && score > 50 && (
              <>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, marginBottom: 16 }}>
                  C'est fait pour toi.
                </h2>
                <p style={{ opacity: 0.75, marginBottom: 32, lineHeight: 1.6 }}>
                  Tu viens de vivre un aperçu de ce que peut être ton quotidien avec {d.prenom} et son équipe. La suite, c'est maintenant.
                </p>
                <PrimaryButton href={d.lienInscription}>
                  <Users size={16} /> Je m'inscris
                </PrimaryButton>
              </>
            )}

            {score !== null && score <= 50 && !leadEnvoye && (
              <>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 600, marginBottom: 16 }}>
                  Parlons-en ensemble.
                </h2>
                <p style={{ opacity: 0.75, marginBottom: 28, lineHeight: 1.6 }}>
                  Ton profil mérite un vrai échange plutôt qu'un score. Laisse-moi tes coordonnées, je te recontacte personnellement.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, textAlign: "left" }}>
                  <input
                    placeholder="Ton prénom"
                    value={lead.nom}
                    onChange={(e) => setLead((l) => ({ ...l, nom: e.target.value }))}
                    style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: COLORS.cream }}
                  />
                  <input
                    placeholder="Ton email"
                    value={lead.email}
                    onChange={(e) => setLead((l) => ({ ...l, email: e.target.value }))}
                    style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: COLORS.cream }}
                  />
                  <input
                    placeholder="Ton téléphone (optionnel)"
                    value={lead.telephone}
                    onChange={(e) => setLead((l) => ({ ...l, telephone: e.target.value }))}
                    style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: COLORS.cream }}
                  />
                </div>
                <PrimaryButton onClick={soumettreLead}>
                  <Send size={16} /> J'envoie mes coordonnées
                </PrimaryButton>
              </>
            )}

            {score !== null && score <= 50 && leadEnvoye && (
              <>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, marginBottom: 16 }}>
                  Merci !
                </h2>
                <p style={{ opacity: 0.75, lineHeight: 1.6 }}>
                  {d.prenom} te recontacte très vite pour échanger.
                </p>
              </>
            )}
          </div>
        </SectionShell>
      )}
    </div>
  );
}
