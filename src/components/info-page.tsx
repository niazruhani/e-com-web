import Link from "next/link";

const pages = {
  about: {
    eyebrow: "About Dhaka Form",
    title: "Our story.",
    intro: "The business story, design process, maker relationships and sourcing information have not yet been provided.",
    detail: "This page is not a claim about manufacturing, sourcing or local partnerships. Add verified brand information before launch.",
  },
  contact: {
    eyebrow: "Customer support",
    title: "Get in touch.",
    intro: "Contact information is not configured.",
    detail: process.env.SUPPORT_EMAIL || process.env.SUPPORT_PHONE
      ? `Support: ${[process.env.SUPPORT_EMAIL, process.env.SUPPORT_PHONE].filter(Boolean).join(" · ")}`
      : "A monitored support email or phone number must be published before accepting orders. The contact form is not yet connected.",
  },
  faq: {
    eyebrow: "Frequently asked questions",
    title: "Answers will go here.",
    intro: "Verified product, payment, delivery, order, cancellation and returns information has not yet been supplied.",
    detail: "Do not rely on sample policy copy. Publish answers reviewed by the business before launch.",
  },
  shipping: {
    eyebrow: "Delivery",
    title: "Shipping information.",
    intro: "Delivery service areas, carriers, fees, delivery estimates and remote-area rules are not yet published.",
    detail: "Configured checkout rates are not a substitute for a customer-facing delivery policy. Confirm the operational details before enabling orders.",
  },
  returns: {
    eyebrow: "Returns & refunds",
    title: "Returns information.",
    intro: "Return eligibility, request process, shipping responsibility, timelines and refund methods are not yet configured.",
    detail: "No return or refund timeframe is promised on this page. Have the final policy reviewed and publish it before launch.",
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy notice.",
    intro: "This starter stores guest cart, wishlist and recently viewed product snapshots in browser storage. Customer accounts and orders use the configured server database.",
    detail: "Before launch, publish reviewed details for legal basis, processors, retention, cookies, access/export/deletion requests and applicable Bangladesh law. This page is not legal advice.",
  },
  terms: {
    eyebrow: "Terms",
    title: "Terms & conditions.",
    intro: "Final sales terms, cancellation, tax treatment, warranties, disputes and governing law have not been supplied.",
    detail: "Have qualified counsel review and publish the actual business terms before accepting orders. This page is not legal advice.",
  },
};

export function InfoPage({ page }: { page: keyof typeof pages }) {
  const content = pages[page];
  return (
    <main className="site-info-page">
      <p className="eyebrow">{content.eyebrow}</p>
      <h1>{content.title}</h1>
      <p>{content.intro}</p>
      <div className="info-detail">
        <h2>Business information</h2>
        <p>{content.detail}</p>
      </div>
      <Link className="button button-dark" href="/collections">Explore the collection <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
