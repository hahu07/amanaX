import { Link } from "react-router-dom";
import styles from "./HomePage.module.css";
import buttonStyles from "../components/Button.module.css";
import { NetworkDiagram } from "./NetworkDiagram";
import {
  IconArrowRight,
  IconClipboardCheck,
  IconFileText,
  IconLayers,
  IconShield,
} from "../components/icons";

const WORKFLOW_STAGES = [
  {
    title: "Propose",
    description: "A Fund Manager proposes a new Shariah-compliant investment product.",
  },
  {
    title: "Structure",
    description: "The Issuing House structures the Investment Note, with AI-assisted recommendations.",
  },
  {
    title: "Shariah & Trustee review",
    description: "The Shariah Advisor certifies compliance; the Trustee reviews governance and investor protection.",
  },
  {
    title: "SEC approval",
    description: "The regulatory submission is reviewed and the issuance is approved by the SEC.",
  },
  {
    title: "Issue",
    description: "The Investment Note is issued and recorded on the shared ledger.",
  },
  {
    title: "Subscribe",
    description: "Investors complete onboarding and subscribe to the offering.",
  },
  {
    title: "Distribute",
    description: "Subscriptions are allocated and profit distributions are processed.",
  },
  {
    title: "Report",
    description: "AI-assisted management, trustee and regulatory reports are generated.",
  },
];

const TRUST_POINTS = [
  {
    icon: <IconLayers />,
    title: "Privacy-preserving, multi-party ledger",
    description:
      "Built on the Canton Network — each institution sees only what it's authorised to see, while every participant shares one source of truth.",
  },
  {
    icon: <IconShield />,
    title: "AI is advisory only",
    description:
      "AI agents recommend structures, checks and reports. Every regulatory and investment decision is made — and recorded — by an authorised professional.",
  },
  {
    icon: <IconClipboardCheck />,
    title: "Full audit trail",
    description: "Every approval and workflow state transition is recorded on-ledger, permanently and verifiably.",
  },
  {
    icon: <IconFileText />,
    title: "Built for Nigerian SEC-regulated institutions",
    description: "Designed around the workflows and reporting obligations of Nigeria's Islamic capital market.",
  },
];

const primaryButtonClass = [buttonStyles.button, buttonStyles.primary].join(" ");

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={[styles.container, styles.headerInner].join(" ")}>
          <span className={styles.brand}>
            Amana<span>X</span>
          </span>
          <Link to="/login" className={primaryButtonClass}>
            Sign in
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Islamic capital market infrastructure · Nigeria</span>
            <h1 className={styles.headline}>
              AI-assisted infrastructure for Shariah-compliant investment products
            </h1>
            <p className={styles.subhead}>
              AmanaX digitises the entire investment product lifecycle — from proposal and structuring to Shariah
              review, SEC approval, issuance, and distribution — so every regulated institution works from one
              shared, privacy-preserving ledger, built on the Canton Network.
            </p>
            <div className={styles.heroActions}>
              <Link to="/login" className={primaryButtonClass}>
                Sign in
              </Link>
              <a href="#network" className={styles.heroSecondaryLink}>
                See how it connects the network <IconArrowRight />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.compareGrid}>
            <div className={[styles.compareCard, styles.compareProblem].join(" ")}>
              <div className={styles.compareLabel}>Today</div>
              <p>
                Issuing and managing Shariah-compliant investment products in Nigeria means coordinating fund
                managers, trustees, Shariah advisors, custodians and the SEC through email threads, spreadsheets and
                paper files — slow, hard to audit, and easy to get wrong.
              </p>
            </div>
            <IconArrowRight className={styles.compareArrow} width={28} height={28} />
            <div className={[styles.compareCard, styles.compareSolution].join(" ")}>
              <div className={styles.compareLabel}>With AmanaX</div>
              <p>
                One shared digital workflow on the Canton Network. Every institution acts on the same source of
                truth, AI assists at each step, and every decision is still made — and recorded — by an authorised
                professional.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="network" className={styles.networkSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div className={styles.sectionLabel}>How it works</div>
            <h2 className={styles.sectionTitle}>Nine institutions. One shared ledger.</h2>
            <p className={styles.sectionDescription}>
              Every participant in the product lifecycle — from the Fund Manager who proposes a product to the SEC
              that approves it — reads and writes to the same Canton ledger, each seeing only what they're
              authorised to see.
            </p>
          </div>
          <div className={styles.diagramWrap}>
            <NetworkDiagram />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div className={styles.sectionLabel}>The lifecycle</div>
            <h2 className={styles.sectionTitle}>From proposal to regulatory report</h2>
            <p className={styles.sectionDescription}>
              A Shariah-compliant Investment Note moves through eight stages, each requiring a specific
              institution's approval before it advances.
            </p>
          </div>
          <ol className={styles.steps}>
            {WORKFLOW_STAGES.map((stage, i) => (
              <li key={stage.title} className={[styles.step, i === 0 ? styles.stepActive : ""].join(" ")}>
                <div className={styles.stepNumber}>{String(i + 1).padStart(2, "0")}</div>
                <div className={styles.stepTitle}>{stage.title}</div>
                <p className={styles.stepDescription}>{stage.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={[styles.section, styles.trustSection].join(" ")}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div className={styles.sectionLabel}>Trust &amp; compliance</div>
            <h2 className={styles.sectionTitle}>Built for regulated institutions</h2>
          </div>
          <div className={styles.trustGrid}>
            {TRUST_POINTS.map((point) => (
              <div key={point.title} className={styles.trustCard}>
                <div className={styles.trustIcon}>{point.icon}</div>
                <div className={styles.trustTitle}>{point.title}</div>
                <p className={styles.trustDescription}>{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={[styles.container, styles.footerInner].join(" ")}>
          <span className={styles.footerBrand}>
            Amana<span>X</span>
          </span>
          <span className={styles.footerTagline}>AI-powered Islamic capital market infrastructure, built on the Canton Network.</span>
        </div>
      </footer>
    </div>
  );
}
