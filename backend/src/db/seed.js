import bcrypt from 'bcrypt';
import { query, closePool } from './connection.js';
import { refreshArticleEmbedding } from '../services/knowledgeSearch.js';

const BCRYPT_SALT_ROUNDS = 12;
const ADMIN_PASSWORD = 'admin-password-2026';
const AGENT_PASSWORD = 'agent-password-2026';
const TICKET_COUNT = 50;
const TREND_WINDOW_DAYS = 30;

let randomState = 987654321;

function nextRandom() {
    randomState = (randomState * 1103515245 + 12345) % 2147483648;
    return randomState / 2147483648;
}

function pick(items) {
    return items[Math.floor(nextRandom() * items.length)];
}

function randomInteger(minimum, maximum) {
    return minimum + Math.floor(nextRandom() * (maximum - minimum + 1));
}

const STAFF = [
    { fullName: 'Layla Haddad', email: 'layla.haddad@supporthub.io', role: 'admin' },
    { fullName: 'Omar Nasser', email: 'omar.nasser@supporthub.io', role: 'agent' },
    { fullName: 'Sara Khalil', email: 'sara.khalil@supporthub.io', role: 'agent' },
    { fullName: 'Yousef Mansour', email: 'yousef.mansour@supporthub.io', role: 'agent' },
    { fullName: 'Nadia Barakat', email: 'nadia.barakat@supporthub.io', role: 'agent' },
    { fullName: 'Tariq Suleiman', email: 'tariq.suleiman@supporthub.io', role: 'agent' },
    { fullName: 'Rana Aziz', email: 'rana.aziz@supporthub.io', role: 'agent' },
    { fullName: 'Karim Dabbagh', email: 'karim.dabbagh@supporthub.io', role: 'agent' },
    { fullName: 'Huda Farouk', email: 'huda.farouk@supporthub.io', role: 'agent' },
    { fullName: 'Basel Rahman', email: 'basel.rahman@supporthub.io', role: 'agent' },
    { fullName: 'Maya Antoun', email: 'maya.antoun@supporthub.io', role: 'agent' },
    { fullName: 'Ziad Hourani', email: 'ziad.hourani@supporthub.io', role: 'agent' },
    { fullName: 'Dina Salloum', email: 'dina.salloum@supporthub.io', role: 'agent' },
    { fullName: 'Firas Obeid', email: 'firas.obeid@supporthub.io', role: 'agent' },
    { fullName: 'Amal Tannous', email: 'amal.tannous@supporthub.io', role: 'admin' }
];

const CUSTOMERS = [
    { name: 'Nour Ibrahim', email: 'nour.ibrahim@northwind.example' },
    { name: 'James Whitfield', email: 'j.whitfield@brightloop.example' },
    { name: 'Priya Raghunathan', email: 'priya.r@kestrelanalytics.example' },
    { name: 'Marta Kowalczyk', email: 'marta.k@vireostudio.example' },
    { name: 'Daniel Okonkwo', email: 'd.okonkwo@harborpay.example' },
    { name: 'Chen Wei', email: 'chen.wei@lumenworks.example' },
    { name: 'Sofia Marchetti', email: 'sofia@atelier-nove.example' },
    { name: 'Hassan Al-Amin', email: 'hassan@dunepost.example' },
    { name: 'Emma Lindqvist', email: 'emma.l@fjordlabs.example' },
    { name: 'Rafael Duarte', email: 'rafael@correiaverde.example' },
    { name: 'Aisha Bello', email: 'aisha.bello@sahelretail.example' },
    { name: 'Thomas Berger', email: 't.berger@steinmetzgmbh.example' }
];

const TICKET_TEMPLATES = [
    {
        category: 'billing',
        priority: 'high',
        subject: 'Charged twice for the November invoice',
        body: 'We were billed 480 USD on 3 November and again on 4 November for the same invoice number INV-20841. Our finance team flagged it this morning. Can you confirm the duplicate and refund one of the charges? The card ending 4417 shows both transactions as settled.'
    },
    {
        category: 'billing',
        priority: 'medium',
        subject: 'Need an invoice with our VAT number on it',
        body: 'Our accountant rejected the last two invoices because they do not include our VAT registration number. Where do I add it so it appears on future invoices, and can you reissue the October and November ones?'
    },
    {
        category: 'billing',
        priority: 'low',
        subject: 'Question about switching from monthly to annual',
        body: 'We are considering moving to the annual plan. If we switch mid-cycle, do we lose the remaining days we already paid for, or is it prorated? Also, does the annual discount apply to the extra seats we added last week?'
    },
    {
        category: 'billing',
        priority: 'urgent',
        subject: 'Account suspended but payment went through',
        body: 'Our workspace was suspended this morning for non-payment, but our bank statement shows the payment cleared four days ago. Fifteen people cannot work right now. Reference number on the transfer is TRF-99213. Please restore access as soon as possible.'
    },
    {
        category: 'billing',
        priority: 'medium',
        subject: 'Refund not received after cancellation',
        body: 'I cancelled on 12 October and was told the prorated refund would take five to seven business days. It has been almost three weeks and nothing has arrived. Could you check the status?'
    },
    {
        category: 'technical',
        priority: 'urgent',
        subject: 'API returning 502 on every request since 09:00',
        body: 'All calls to the /v2/orders endpoint have returned 502 Bad Gateway since roughly 09:00 UTC. Our checkout flow is completely down and we are losing orders. Nothing changed on our side, our last deploy was Tuesday.'
    },
    {
        category: 'technical',
        priority: 'high',
        subject: 'Webhooks stopped firing after we rotated our secret',
        body: 'We rotated the signing secret yesterday as recommended. Since then no webhook events have reached our endpoint. The dashboard shows the events as delivered but our server never receives them. We updated the secret in our verification code.'
    },
    {
        category: 'technical',
        priority: 'medium',
        subject: 'CSV export is missing the last column',
        body: 'When I export the report as CSV, the final column with the tags is always empty even though the tags are visible in the web view. The XLSX export works fine. This started after last week update.'
    },
    {
        category: 'technical',
        priority: 'high',
        subject: 'Dashboard extremely slow with large datasets',
        body: 'Since we crossed about 50,000 records, the analytics dashboard takes over 40 seconds to load and sometimes times out entirely. Filtering by date range does not help. Smaller workspaces of ours load instantly.'
    },
    {
        category: 'technical',
        priority: 'medium',
        subject: 'Attachments over 10 MB fail silently',
        body: 'When a customer attaches a file larger than about 10 MB, the upload spinner runs and then the page just returns to the form with no error message. Nothing appears in the ticket. Smaller files upload fine.'
    },
    {
        category: 'technical',
        priority: 'low',
        subject: 'Dark mode text is unreadable in the editor',
        body: 'In dark mode the code block text in the reply editor renders dark grey on a dark background, which is basically unreadable. Light mode is fine. Firefox 132 on Ubuntu.'
    },
    {
        category: 'technical',
        priority: 'urgent',
        subject: 'Data from another company appearing in our workspace',
        body: 'Three tickets appeared in our queue this morning that clearly belong to a different company, with their customer names and email addresses. This looks like a serious data isolation problem. We have screenshots. Please treat as urgent.'
    },
    {
        category: 'technical',
        priority: 'medium',
        subject: 'Timezone on the reports is wrong',
        body: 'Our workspace timezone is set to Europe/Berlin but the daily report boundaries seem to follow UTC. Tickets created after 01:00 local time are counted on the previous day, which makes our numbers disagree with what the team sees.'
    },
    {
        category: 'account',
        priority: 'high',
        subject: 'Cannot log in, password reset email never arrives',
        body: 'I have requested a password reset six times over the last two hours and nothing arrives. I checked spam and our IT confirmed nothing is being blocked at the mail gateway. My address is the one on this ticket.'
    },
    {
        category: 'account',
        priority: 'urgent',
        subject: 'Locked out after enabling two factor authentication',
        body: 'I enabled 2FA yesterday and then my phone was replaced by IT. I no longer have the authenticator app and I did not save the recovery codes. I am the only administrator on the account and nobody can add users right now.'
    },
    {
        category: 'account',
        priority: 'medium',
        subject: 'Need to transfer ownership to a different admin',
        body: 'Our previous administrator left the company last Friday. Her account still owns the workspace and the billing contact. What is the process for transferring ownership to me, and what proof do you need?'
    },
    {
        category: 'account',
        priority: 'low',
        subject: 'How do I change the email on my profile?',
        body: 'I got married and changed my surname, so my work email changed too. I can see the name field in settings but the email field appears to be read only. How do I update it without losing my ticket history?'
    },
    {
        category: 'account',
        priority: 'medium',
        subject: 'Agent can see tickets they should not have access to',
        body: 'One of our junior agents reports that she can open tickets assigned to the billing team, which should be restricted for her role. Can you confirm how role permissions are supposed to work, and whether something is misconfigured on our side?'
    },
    {
        category: 'account',
        priority: 'high',
        subject: 'SSO login loops back to the sign in page',
        body: 'After configuring SAML with our identity provider, users are redirected back to the sign in page instead of into the app. The IdP logs show a successful assertion. Our metadata URL and certificate were both updated last week.'
    },
    {
        category: 'other',
        priority: 'low',
        subject: 'Feature request: keyboard shortcuts for the ticket list',
        body: 'Our agents handle around 200 tickets a day and the mouse round trip is slowing them down. Would it be possible to add j and k navigation and a shortcut to open the reply box? Happy to help test it.'
    },
    {
        category: 'other',
        priority: 'low',
        subject: 'Do you have a status page we can subscribe to?',
        body: 'During the outage last month we had no way to know whether the problem was on our side. Is there a public status page or an incident mailing list we can subscribe our on-call team to?'
    },
    {
        category: 'other',
        priority: 'medium',
        subject: 'Request for a signed data processing agreement',
        body: 'Our legal team needs a signed DPA before we can renew. We also need the list of subprocessors and the location where customer data is stored. Who should I send our template to?'
    },
    {
        category: 'other',
        priority: 'low',
        subject: 'Is there an onboarding session for new agents?',
        body: 'We are adding six new agents next month. Do you offer a live onboarding session, or is there a recorded walkthrough we can share with them ahead of time?'
    },
    {
        category: 'technical',
        priority: 'high',
        subject: 'Search returns no results for exact ticket numbers',
        body: 'Searching for a ticket by its full number, for example 20841, returns nothing, but the ticket clearly exists and opens fine from the list. Searching by the customer name works. This makes it very slow to find a specific case.'
    },
    {
        category: 'billing',
        priority: 'medium',
        subject: 'Seat count does not match the number of active agents',
        body: 'We are being billed for 24 seats but we only have 19 active agents. Five people were deactivated in September. Does deactivating a user free up the seat, or do we need to delete the account entirely?'
    },
    {
        category: 'account',
        priority: 'medium',
        subject: 'Deactivated agent still receiving notification emails',
        body: 'We deactivated an agent three weeks ago when he left, but he says he is still receiving ticket assignment notifications at his old work address. That address is forwarded to his personal inbox, so this is a privacy concern for us.'
    }
];

const KNOWLEDGE_BASE_ARTICLES = [
    {
        title: 'Resolving duplicate charges on an invoice',
        category: 'billing',
        tags: ['billing', 'refund', 'duplicate'],
        content: `A duplicate charge happens when a payment is retried after a temporary authorisation failure and both attempts eventually settle.

How to confirm a duplicate:
1. Open the workspace in the billing console and search by invoice number.
2. A genuine duplicate shows two settled transactions with the same invoice number and the same amount, dated within 72 hours of each other.
3. Two charges with different invoice numbers are not duplicates. They are usually a subscription renewal plus a seat adjustment.

How to resolve:
- Refund the later transaction, never the earlier one. Refunding the earlier transaction breaks the invoice reconciliation.
- Refunds are issued to the original payment method only.
- Card refunds appear on the customer statement within five to ten business days. Bank transfer refunds take up to fifteen business days.
- Always give the customer the refund reference number so their finance team can match it.

If the two charges have different amounts, this is a proration adjustment, not a duplicate. Explain the proration instead of refunding.`
    },
    {
        title: 'Adding a VAT or tax registration number to invoices',
        category: 'billing',
        tags: ['billing', 'invoice', 'vat', 'tax'],
        content: `Tax identifiers are stored on the workspace billing profile, not on individual invoices.

To add or change a tax number:
1. Go to Settings, then Billing, then Billing profile.
2. Enter the tax registration number in the Tax ID field and save.
3. The number appears on every invoice generated after the change.

Reissuing past invoices:
- Invoices from the current billing period are regenerated automatically within one hour of saving the tax ID.
- Invoices older than the current period must be reissued manually by support. We can reissue up to twelve months of history.
- The reissued invoice keeps the original invoice number and date. Only the tax details change, which is what accounting teams require.

We cannot change the legal entity name on a historical invoice. If the entity itself changed, a credit note plus a new invoice is required.`
    },
    {
        title: 'Switching between monthly and annual billing',
        category: 'billing',
        tags: ['billing', 'plan', 'proration'],
        content: `Customers can switch plans at any time from Settings, then Billing, then Change plan.

Monthly to annual:
- The unused portion of the current month is credited against the annual invoice. Nothing is lost.
- The annual discount applies to the full seat count at the moment of the switch, including seats added earlier in the cycle.
- The new billing anniversary is the date of the switch.

Annual to monthly:
- The change takes effect at the end of the paid annual term. We do not refund the remaining months of an annual term.
- Seats can still be added or removed during the annual term. Added seats are prorated to the end of the term.

Seat changes on an annual plan are invoiced immediately, not at renewal.`
    },
    {
        title: 'Account suspended while a payment is in transit',
        category: 'billing',
        tags: ['billing', 'suspension', 'payment'],
        content: `Suspension is triggered automatically seven days after an invoice becomes overdue. Bank transfers frequently take longer than that to be matched, which produces false suspensions.

Immediate action:
1. Ask the customer for the transfer reference and the value date.
2. Search unmatched incoming payments in the billing console using that reference.
3. If the payment is found, match it to the invoice. Access is restored within five minutes of matching, with no data loss.
4. If the payment is not found, grant a seven day grace period from the account status panel and ask the customer for proof of transfer.

Never ask a customer to pay a second time to restore access. Use the grace period instead.

Suspended workspaces retain all data. Deletion only happens after ninety days of continuous suspension, and we send three warning emails before that point.`
    },
    {
        title: 'Password reset emails are not arriving',
        category: 'account',
        tags: ['account', 'login', 'email'],
        content: `Work through these causes in order.

1. Wrong address. Reset emails are only sent to addresses that exist in the system. For security, the reset page shows the same confirmation whether or not the address exists. Check the exact spelling of the address on the account.

2. Rate limiting. After five reset requests within one hour, further requests are silently dropped for that hour. Repeated requests make the problem worse, not better. Wait for the hour to pass.

3. Deactivated account. Deactivated users cannot receive reset emails. Reactivate the user first.

4. SSO is enforced. If the workspace enforces single sign on, password reset is disabled entirely and no email is ever sent. The user must sign in through the identity provider.

5. Mail filtering. Our reset emails come from no-reply@supporthub.io. Ask the customer to allowlist that address at the gateway, not only in the individual mailbox.

An administrator can always trigger a reset on behalf of a user from the user detail page, which uses a separate delivery path.`
    },
    {
        title: 'Recovering an account locked by two factor authentication',
        category: 'account',
        tags: ['account', '2fa', 'recovery', 'security'],
        content: `Losing the second factor is the most common lockout we handle. The recovery path depends on whether another administrator exists.

If another active administrator exists:
- That administrator can reset the second factor from the user detail page. This is the fastest path and requires no verification from us.

If the locked user is the only administrator:
- We require identity verification before resetting the second factor, because this is the highest risk operation we perform.
- Required: a request from the email address on the account, plus confirmation from a second contact already listed on the workspace, plus the last four digits of the payment method on file.
- Verification is reviewed by a senior agent and typically completes within one business day. It is never completed instantly, regardless of urgency.

Recovery codes are shown once when two factor authentication is enabled and are never recoverable afterwards. Encourage customers to store them in their password manager and to keep a second administrator on every workspace.`
    },
    {
        title: 'How agent and admin roles differ',
        category: 'account',
        tags: ['account', 'roles', 'permissions'],
        content: `There are exactly two staff roles. Customers are not users of the system and never receive an account.

Agent:
- Can see tickets they created and tickets assigned to them.
- Can reply to those tickets, add internal notes, and change their status.
- Cannot see the analytics dashboard, the user list, or tickets belonging to other agents.

Admin:
- Can see and act on every ticket in the workspace.
- Can create, deactivate, and change the role of staff accounts.
- Can assign and reassign tickets.
- Can manage knowledge base articles and view the analytics dashboard.

There is no per-team or per-category restriction beyond this. If an agent reports seeing a ticket they did not expect, check whether that ticket was assigned to them or created by them, which is the intended behaviour.

Role changes take effect when the affected user next signs in, because the role is carried inside their session token until it expires.`
    },
    {
        title: 'Diagnosing webhook delivery failures',
        category: 'technical',
        tags: ['technical', 'webhooks', 'integration'],
        content: `The dashboard marks an event as delivered when the receiving endpoint returns a 2xx status. If the dashboard shows delivered but the application never processed the event, the request reached the server and was rejected inside the application.

The most frequent cause after a secret rotation is verifying the signature against the wrong secret. Both the old and the new secret stay valid for twenty four hours after rotation, so during that window an endpoint must accept either.

Checklist:
1. Compute the signature over the raw request body. Parsing the JSON first and re-serialising it changes the bytes and breaks the signature.
2. Compare signatures with a constant time comparison, not string equality.
3. Confirm the endpoint returns 2xx before doing slow work. Do the work asynchronously and acknowledge immediately.
4. Check the delivery log in Settings, then Webhooks, which stores the exact request body and response for seven days.

Failed deliveries are retried with exponential backoff for twenty four hours. After that the event is dropped and must be replayed manually from the delivery log.`
    },
    {
        title: 'Attachment size and type limits',
        category: 'technical',
        tags: ['technical', 'attachments', 'limits'],
        content: `The maximum size for a single attachment is 10 MB. The maximum total size for one ticket or reply is 25 MB.

Uploads that exceed the limit are rejected by the storage service before they reach the application, which is why the browser can appear to fail without a message. This is a known gap in the error handling and is tracked internally.

Workarounds to offer:
- Compress images before attaching. A screenshot saved as PNG is often three to four times larger than the same image as JPEG.
- For log files, ask for a compressed archive, which usually reduces size by more than ninety percent.
- For anything larger, ask the customer to share a link from their own file storage instead.

Blocked file types cannot be attached at all: executables, scripts, and archives containing executables. This cannot be disabled per workspace.`
    },
    {
        title: 'Why dashboard and report totals disagree with the ticket list',
        category: 'technical',
        tags: ['technical', 'reports', 'timezone'],
        content: `Report boundaries and list timestamps can be based on different clocks, which makes totals look wrong when they are not.

How dates are handled:
- Every timestamp is stored in UTC.
- The ticket list renders timestamps in the browser local timezone.
- Report and dashboard day boundaries follow the workspace timezone set in Settings, then General.

If the workspace timezone was never set, it defaults to UTC. For a team in Berlin, that moves the day boundary two hours, so tickets created between midnight and 02:00 local time are counted on the previous day.

Fix: set the workspace timezone explicitly. Reports are recalculated on the next load. Historical data is not rewritten, because the underlying timestamps never changed, only how they are grouped.

The average first response time metric measures the interval between ticket creation and the first non internal reply. Internal notes are deliberately excluded, so adding a note does not stop the clock.`
    }
];

async function tablesAlreadyPopulated() {
    const result = await query(
        `SELECT
             (SELECT count(*) FROM users)::int AS users,
             (SELECT count(*) FROM tickets)::int AS tickets,
             (SELECT count(*) FROM knowledge_base)::int AS articles`
    );

    const counts = result.rows[0];
    return counts.users > 0 || counts.tickets > 0 || counts.articles > 0;
}

async function insertStaff() {
    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);
    const agentPasswordHash = await bcrypt.hash(AGENT_PASSWORD, BCRYPT_SALT_ROUNDS);

    const inserted = [];

    for (const person of STAFF) {
        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, full_name, role`,
            [
                person.email,
                person.role === 'admin' ? adminPasswordHash : agentPasswordHash,
                person.fullName,
                person.role
            ]
        );

        inserted.push(result.rows[0]);
    }

    return inserted;
}

async function insertKnowledgeBase(adminId) {
    const inserted = [];

    for (const article of KNOWLEDGE_BASE_ARTICLES) {
        const result = await query(
            `INSERT INTO knowledge_base (created_by, title, content, category, tags)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, title, content`,
            [adminId, article.title, article.content, article.category, article.tags]
        );

        inserted.push(result.rows[0]);
    }

    return inserted;
}

function buildTicketPlan(index) {
    const template = TICKET_TEMPLATES[index % TICKET_TEMPLATES.length];
    const customer = pick(CUSTOMERS);

    const daysAgo = randomInteger(0, TREND_WINDOW_DAYS - 1);
    const hourOfDay = randomInteger(7, 19);
    const minuteOfHour = randomInteger(0, 59);

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(hourOfDay, minuteOfHour, 0, 0);

    const isAnswered = nextRandom() < 0.78;
    const responseDelayMinutes = randomInteger(4, 600);
    const firstResponseAt = isAnswered
        ? new Date(createdAt.getTime() + responseDelayMinutes * 60 * 1000)
        : null;

    let status = 'open';

    if (isAnswered) {
        const roll = nextRandom();
        status = roll < 0.45 ? 'resolved' : roll < 0.75 ? 'in_progress' : 'closed';
    }

    const closedAt =
        status === 'resolved' || status === 'closed'
            ? new Date(firstResponseAt.getTime() + randomInteger(30, 4000) * 60 * 1000)
            : null;

    return {
        template,
        customer,
        createdAt,
        firstResponseAt,
        closedAt,
        status,
        confidence: Number((0.72 + nextRandom() * 0.27).toFixed(3))
    };
}

const AGENT_REPLY_OPENINGS = [
    'Thanks for the detail, that helped a lot.',
    'Sorry for the trouble here.',
    'Good catch, and thank you for the clear description.',
    'Thanks for waiting while I checked this with the team.'
];

const AGENT_REPLY_BODIES = [
    'I have reproduced what you are seeing and confirmed the cause on our side. The fix is applied to your workspace now, so please refresh and let me know if anything still looks wrong.',
    'I have checked the account and applied the change you asked for. It should be visible within the next few minutes. I have also added a note so the next person who picks this up has the full history.',
    'This one needs input from our engineering team, so I have escalated it with everything you sent. I will come back to you with an update by the end of tomorrow at the latest.',
    'I have walked through the settings on your workspace and corrected the configuration. Could you confirm on your side that it now behaves as expected?'
];

async function insertTickets(staff, adminId) {
    const agents = staff.filter((person) => person.role === 'agent');

    for (let index = 0; index < TICKET_COUNT; index += 1) {
        const plan = buildTicketPlan(index);
        const creator = pick(staff);
        const assignee = nextRandom() < 0.85 ? pick(agents) : null;

        const ticketResult = await query(
            `INSERT INTO tickets (
                 created_by, assigned_to, customer_name, customer_email,
                 subject, body, status, priority, category,
                 ai_confidence, ai_classified_at,
                 first_response_at, closed_at, created_at, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
             RETURNING id`,
            [
                creator.id,
                assignee ? assignee.id : null,
                plan.customer.name,
                plan.customer.email,
                plan.template.subject,
                plan.template.body,
                plan.status,
                plan.template.priority,
                plan.template.category,
                plan.confidence,
                plan.createdAt,
                plan.firstResponseAt,
                plan.closedAt,
                plan.createdAt
            ]
        );

        const ticketId = ticketResult.rows[0].id;

        if (!plan.firstResponseAt) {
            continue;
        }

        const replyCount = randomInteger(1, 3);
        let replyTimestamp = plan.firstResponseAt;

        for (let replyIndex = 0; replyIndex < replyCount; replyIndex += 1) {
            const author = assignee ?? pick(agents);
            const usedAiSuggestion = nextRandom() < 0.62;
            const suggestionText = `${pick(AGENT_REPLY_OPENINGS)} ${pick(AGENT_REPLY_BODIES)}`;
            const acceptedUnchanged = usedAiSuggestion && nextRandom() < 0.41;

            const finalBody = acceptedUnchanged
                ? suggestionText
                : `${suggestionText} Please reply here if anything is still unclear and I will pick it straight back up.`;

            await query(
                `INSERT INTO replies (
                     ticket_id, author_id, body, is_internal_note,
                     was_ai_suggested, ai_suggestion_text, created_at
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    ticketId,
                    author.id,
                    finalBody,
                    false,
                    usedAiSuggestion,
                    usedAiSuggestion ? suggestionText : null,
                    replyTimestamp
                ]
            );

            replyTimestamp = new Date(replyTimestamp.getTime() + randomInteger(20, 900) * 60 * 1000);
        }

        if (nextRandom() < 0.22) {
            await query(
                `INSERT INTO replies (ticket_id, author_id, body, is_internal_note, created_at)
                 VALUES ($1, $2, $3, TRUE, $4)`,
                [
                    ticketId,
                    adminId,
                    'Internal note: customer is on the annual enterprise plan, keep the response time under two hours.',
                    plan.firstResponseAt
                ]
            );
        }
    }
}

async function main() {
    const shouldReset = process.argv.includes('--reset');

    if (await tablesAlreadyPopulated()) {
        if (!shouldReset) {
            console.error(
                'The database already contains data. Re-run with --reset to delete everything and seed from scratch.'
            );
            process.exitCode = 1;
            return;
        }

        console.log('Clearing existing data');
        await query('TRUNCATE replies, tickets, knowledge_base, users RESTART IDENTITY CASCADE');
    }

    console.log('Inserting staff accounts');
    const staff = await insertStaff();
    const adminId = staff.find((person) => person.role === 'admin').id;

    console.log('Inserting knowledge base articles');
    const articles = await insertKnowledgeBase(adminId);

    console.log('Inserting tickets and replies');
    await insertTickets(staff, adminId);

    console.log('Generating embeddings if a provider is configured');
    for (const article of articles) {
        await refreshArticleEmbedding(article.id, article.title, article.content);
    }

    console.log('');
    console.log('Seed complete.');
    console.log(`  staff accounts:  ${staff.length}`);
    console.log(`  tickets:         ${TICKET_COUNT}`);
    console.log(`  articles:        ${articles.length}`);
    console.log('');
    console.log('Sign in with:');
    console.log(`  admin  ${STAFF[0].email}  /  ${ADMIN_PASSWORD}`);
    console.log(`  agent  ${STAFF[1].email}  /  ${AGENT_PASSWORD}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => closePool());
