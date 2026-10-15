"use client";

const OP = "[LEGAL NAME OF OPERATOR]";
const EMAIL = "[SUPPORT EMAIL]";
const UPDATED = "October 15, 2026";

function Sec({ n, t, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3 style={{ margin: "0 0 8px" }}>
        {n}. {t}
      </h3>
      {children}
    </section>
  );
}

export default function Terms() {
  return (
    <main className="rt" style={{ lineHeight: 1.65 }}>
      <button
        className="ghost"
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else window.location.href = "/";
        }}
      >
        Back
      </button>

      <h1>Terms of Service and Privacy Policy</h1>
      <p className="muted">Routiq. Last updated: {UPDATED}</p>
      <p>
        These documents are an agreement between you and {OP} ("we", "us", "Routiq"). By creating an
        account or using Routiq you accept both parts below. If you do not accept them, do not use
        Routiq.
      </p>

      <h2>Part A. Terms of Service</h2>

      <Sec n="1" t="The service">
        <p>
          Routiq is a web application that helps a business plan multi-stop driving routes. You enter
          locations, clients, trips and schedules, and Routiq suggests a stop order and estimated
          times, distances and fuel figures. Routiq does not provide transport services, does not
          employ drivers, and is not a party to any arrangement between you and your clients or
          drivers.
        </p>
      </Sec>

      <Sec n="2" t="Eligibility and accounts">
        <ul>
          <li>You must be at least 18 years old and able to enter a binding contract.</li>
          <li>
            If you register on behalf of a company, you confirm you have authority to bind that
            company. "You" then means the company and the individual.
          </li>
          <li>Usernames are unique. Information you give at sign-up must be accurate and kept current.</li>
          <li>
            You are responsible for keeping your password confidential and for all activity under your
            account. Tell us at once if you suspect unauthorized access.
          </li>
        </ul>
      </Sec>

      <Sec n="3" t="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>use Routiq for anything unlawful, or to harm, harass, track or stalk any person;</li>
          <li>upload data you have no right to use, including personal data collected without a lawful basis;</li>
          <li>attempt to access another company's data, probe or bypass security, or overload the service;</li>
          <li>copy, resell, sublicense, reverse engineer or scrape the service, except as the law allows;</li>
          <li>use automated means to send requests in a way that harms the service or its third-party providers;</li>
          <li>upload malware or content that infringes anyone's rights.</li>
        </ul>
      </Sec>

      <Sec n="4" t="Your data and your responsibilities">
        <ul>
          <li>
            You own the data you put into Routiq ("Customer Data"), including locations, client
            details, trips and schedules. You give us a limited licence to host, process and display it
            only to provide and secure the service.
          </li>
          <li>
            You are responsible for the lawfulness of Customer Data. You confirm that you have all
            consents, notices and legal bases needed to give us your clients' personal data, including
            phone numbers and parents' phone numbers, and that you will respect their rights.
          </li>
          <li>
            If any client is under 18, you confirm you hold the consent of a parent or guardian for
            the data you enter about them.
          </li>
          <li>You are responsible for backing up anything you cannot afford to lose.</li>
        </ul>
      </Sec>

      <Sec n="5" t="Route and time estimates: important limits">
        <ul>
          <li>
            Estimates of order, distance, time, arrival and fuel are guidance only. They are based on
            map data and a manual traffic factor, not live traffic. They can differ from real
            conditions and from other map services.
          </li>
          <li>
            Stop order is chosen to reduce distance, not time, cost or safety. It may not suit road
            closures, permits, vehicle restrictions, opening hours or passenger needs.
          </li>
          <li>
            Location lookups by name or short link can return the wrong place. Check every location
            before relying on it.
          </li>
          <li>
            Drivers must obey traffic law and use their own judgment. Routiq is not a navigation or
            emergency system and must not be used where life or safety depends on its output.
          </li>
          <li>
            Capacity and passenger settings help planning only. You remain responsible for vehicle
            loading, seatbelts, child seats and legal passenger limits.
          </li>
        </ul>
      </Sec>

      <Sec n="6" t="Third-party services">
        <p>
          Routiq relies on third parties, including hosting and database providers, open map data and
          public routing and geocoding services, and links that open Google Maps. Those services have
          their own terms and may change, limit or stop working without notice. We are not liable for
          their performance. Map data is derived from OpenStreetMap contributors.
        </p>
      </Sec>

      <Sec n="7" t="Fees">
        <p>
          Fees, billing periods and refund rules are those shown to you when you buy or as agreed in
          writing. Unless stated otherwise, fees are exclusive of taxes and are non-refundable except
          where the law requires. We may change prices for future periods with reasonable notice.
        </p>
      </Sec>

      <Sec n="8" t="Intellectual property">
        <p>
          Routiq, its software, design and branding belong to {OP} or its licensors. You receive a
          limited, non-exclusive, non-transferable right to use the service during your subscription
          or licence for your own business. No other rights are granted. If you send feedback, we may
          use it freely without obligation to you.
        </p>
      </Sec>

      <Sec n="9" t="Availability and changes">
        <p>
          We aim for reliable service but do not promise uninterrupted or error-free operation. We may
          perform maintenance, change features or discontinue parts of the service. We will try to
          give reasonable notice of material changes that reduce core functionality.
        </p>
      </Sec>

      <Sec n="10" t="Disclaimer of warranties">
        <p>
          To the fullest extent permitted by law, Routiq is provided "as is" and "as available".
          We disclaim all warranties, express or implied, including merchantability, fitness for a
          particular purpose, accuracy, and non-infringement.
        </p>
      </Sec>

      <Sec n="11" t="Limitation of liability">
        <p>To the fullest extent permitted by law:</p>
        <ul>
          <li>
            we are not liable for indirect, incidental, special, consequential or punitive damages, or
            for lost profits, revenue, data, goodwill, missed appointments or delays;
          </li>
          <li>
            we are not liable for accidents, injuries, fines, vehicle damage or claims arising from
            driving, vehicle use or reliance on estimates;
          </li>
          <li>
            our total liability for any claim relating to the service is limited to the fees you paid
            us in the 12 months before the event, or a nominal amount if the service was free.
          </li>
        </ul>
        <p>Nothing here limits liability that cannot be limited by law, such as for fraud or gross negligence.</p>
      </Sec>

      <Sec n="12" t="Indemnity">
        <p>
          You will defend and compensate us against claims, losses and costs (including reasonable
          legal fees) arising from your Customer Data, your breach of these terms or the law, your
          operation of vehicles or transport services, or your dealings with your clients and drivers.
        </p>
      </Sec>

      <Sec n="13" t="Suspension and termination">
        <p>
          You may stop using Routiq and ask us to close your account at any time. We may suspend or
          end your access if you breach these terms, create risk or legal exposure for us or others,
          or fail to pay. On closure we will delete or anonymize Customer Data under Part B, subject to
          legal retention duties. Sections that by nature should survive (including 4, 8, 10 to 12 and
          15) survive termination.
        </p>
      </Sec>

      <Sec n="14" t="Changes to these documents">
        <p>
          We may update these terms and policy. We will show the new date and, for material changes,
          give notice in the app or by phone or email. Continued use after the effective date means
          you accept the update. If you disagree, stop using the service.
        </p>
      </Sec>

      <Sec n="15" t="Governing law and disputes">
        <p>
          These terms are governed by the laws of the Arab Republic of Egypt. Disputes are first to be
          raised in writing so we can try to settle them in good faith for 30 days. Failing that, the
          competent courts of Cairo have exclusive jurisdiction, unless mandatory law gives you rights
          elsewhere.
        </p>
      </Sec>

      <Sec n="16" t="General">
        <ul>
          <li>These documents are the whole agreement on their subject and replace earlier versions.</li>
          <li>If a clause is unenforceable, the rest stays in force.</li>
          <li>Not enforcing a right is not a waiver of it.</li>
          <li>You may not assign your rights without our consent. We may assign ours with notice.</li>
          <li>We are not liable for failure caused by events beyond our reasonable control.</li>
          <li>Notices to us go to {EMAIL}.</li>
        </ul>
      </Sec>

      <h2 style={{ marginTop: 36 }}>Part B. Privacy Policy</h2>

      <Sec n="1" t="Who is responsible for data">
        <ul>
          <li>
            For account data (username, password, company name, phone number) {OP} is the controller.
          </li>
          <li>
            For Customer Data about your clients, drivers and locations, you are the controller and we
            act as your processor. We process it only on your instructions, to provide the service.
          </li>
        </ul>
      </Sec>

      <Sec n="2" t="What we collect">
        <ul>
          <li>Account data: username, a hashed password, company name and phone number.</li>
          <li>
            Customer Data you enter: saved locations (names and coordinates), clients (names, stops,
            phone numbers, parents' phone numbers, requested start and drop-off, days), trips,
            schedules and notes.
          </li>
          <li>
            Technical data: device and browser type, IP address, timestamps, error logs, and
            settings stored in your browser (for example your light or dark mode choice).
          </li>
        </ul>
        <p>We do not intentionally collect sensitive categories of data. Please do not enter any.</p>
      </Sec>

      <Sec n="3" t="Why we use it">
        <ul>
          <li>To create and secure your account and run the service you asked for.</li>
          <li>To calculate routes, times and schedules.</li>
          <li>To prevent abuse, fix bugs, and keep the service reliable.</li>
          <li>To contact you about the service, billing and important changes.</li>
          <li>To meet legal obligations.</li>
        </ul>
        <p>
          The legal bases are performance of our contract with you, our legitimate interests in
          running and protecting the service, legal duties and, where required, your consent.
        </p>
      </Sec>

      <Sec n="4" t="Location data and routing providers">
        <p>
          To calculate a route, coordinates (and, for name searches, place names you typed) are sent to
          routing and geocoding services. We send only what is needed for the calculation and do not
          send client names or phone numbers to them. Opening a Google Maps link sends the route
          coordinates to Google under Google's own terms.
        </p>
      </Sec>

      <Sec n="5" t="Sharing">
        <p>
          We do not sell personal data. We share it only with service providers that help us run
          Routiq (hosting, database, routing and geocoding, security and support) under appropriate
          terms, with authorities when the law requires, and in a business transfer with the same
          protections. Each company's data is kept separate from other companies' data.
        </p>
      </Sec>

      <Sec n="6" t="International transfers">
        <p>
          Our providers may store or process data outside Egypt. Where we transfer personal data
          abroad, we do so in line with applicable law, including Egypt's Personal Data Protection Law
          (Law No. 151 of 2020) and its executive rules, and we use contractual and technical
          safeguards.
        </p>
      </Sec>

      <Sec n="7" t="Security">
        <p>
          We use measures such as encrypted connections, hashed passwords and access controls that
          separate each company's data. No system is completely secure. Keep your password private and
          sign out on shared devices. If a breach affects your data we will notify you and the
          authorities as the law requires.
        </p>
      </Sec>

      <Sec n="8" t="How long we keep data">
        <p>
          We keep account data while your account is open. Customer Data stays until you delete it or
          close your account, after which we delete or anonymize it within a reasonable period, except
          where law requires longer retention or backups need time to expire.
        </p>
      </Sec>

      <Sec n="9" t="Your rights">
        <p>
          Subject to law, you may ask to access, correct, update, delete, restrict or object to the
          processing of your personal data, to withdraw consent, and to lodge a complaint with the
          competent data protection authority. Clients of a company should contact that company first,
          because it controls their data. Write to {EMAIL} and we will respond within a reasonable time.
        </p>
      </Sec>

      <Sec n="10" t="Children">
        <p>
          Routiq is for businesses and is not directed to children. Companies may enter details of
          minors they transport and must hold a parent or guardian's consent to do so. If you believe a
          child has used Routiq directly, contact us and we will act.
        </p>
      </Sec>

      <Sec n="11" t="Cookies and local storage">
        <p>
          We use browser storage and similar technology that is strictly necessary to keep you signed
          in and to remember settings such as light or dark mode. We do not use advertising trackers.
        </p>
      </Sec>

      <Sec n="12" t="Contact">
        <p>
          {OP}. Email: {EMAIL}. Questions about these documents or your data can be sent there.
        </p>
      </Sec>
    </main>
  );
}