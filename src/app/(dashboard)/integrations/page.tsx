import { auth } from "@/lib/auth";
import { getOrCreateOrg } from "@/lib/org";
import { generateIntakeToken } from "@/lib/leads/intake-token";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { IntakeUrlCopy } from "@/components/integrations/intake-url-copy";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const org = await getOrCreateOrg(session.user.id, session.user.email!);
  const token = generateIntakeToken(org.id);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://smartlineagent.com";
  const intakeUrl = `${baseUrl}/api/public/leads/${token}`;

  const fbExample = JSON.stringify(
    {
      full_name: "Jane Doe",
      phone_number: "+15551234567",
      email: "jane@example.com",
      form_name: "Oct Campaign",
    },
    null,
    2
  );

  const genericExample = JSON.stringify(
    {
      first_name: "Jane",
      last_name: "Doe",
      phone: "+15551234567",
      email: "jane@example.com",
      company: "Acme Corp",
      segment: "hot-leads",
      source: "my-crm",
    },
    null,
    2
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Integrations</h1>
        <p className="mt-1 text-gray-500">
          Send leads into SmartLine from Facebook Lead Ads, your CRM, Zapier,
          Make, or any tool that can POST a webhook.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your lead intake URL</CardTitle>
          <CardDescription>
            Unique to your account. Paste it into any tool that sends webhooks.
            Keep it private — anyone with this URL can submit leads to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntakeUrlCopy url={intakeUrl} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Facebook Lead Ads</CardTitle>
            <CardDescription>
              Use Zapier or Make to forward new leads to SmartLine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>
                In Zapier, create a new Zap with <strong>Facebook Lead Ads</strong>{" "}
                → &quot;New Lead&quot; as the trigger.
              </li>
              <li>
                Pick your Page and the Lead Form you want to route. Zapier will
                pull in a sample lead.
              </li>
              <li>
                For the action, choose <strong>Webhooks by Zapier</strong> →{" "}
                <strong>POST</strong>.
              </li>
              <li>
                Paste the intake URL above into the <em>URL</em> field. Set{" "}
                <em>Payload Type</em> to <strong>JSON</strong>.
              </li>
              <li>
                Map the fields (Zapier does this for you) and turn the Zap on.
              </li>
            </ol>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Sample payload
            </p>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
              {fbExample}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CRMs &amp; other tools</CardTitle>
            <CardDescription>
              HubSpot, Salesforce, Pipedrive, GoHighLevel, custom forms — any
              tool that can fire a webhook.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-700">
              POST <strong>any JSON</strong> to the intake URL. SmartLine
              auto-detects phone, email, and name fields from the most common
              naming conventions, including nested <code>properties</code> or{" "}
              <code>field_data</code> shapes.
            </p>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Minimum viable payload
            </p>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
              {genericExample}
            </pre>
            <p className="mt-4 text-xs text-gray-500">
              Only <code>phone</code> (or <code>phone_number</code>) is required.
              Everything else is optional. Unknown fields are preserved on the
              lead.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drop leads straight into a campaign</CardTitle>
            <CardDescription>
              Append <code>?campaignId=…</code> to the URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              Each new lead is added to that campaign and — if the campaign is
              running and inside its call window — dialled automatically.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
              {`POST ${intakeUrl}?campaignId=CAMPAIGN_ID
Content-Type: application/json

{ "phone": "+15551234567", "first_name": "Jane" }`}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick test</CardTitle>
            <CardDescription>
              Verify the URL works before wiring up Zapier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-gray-700">
              Send a one-off test with <code>curl</code>:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
              {`curl -X POST '${intakeUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '{"phone":"+15551234567","first_name":"Test","last_name":"Lead"}'`}
            </pre>
            <p className="mt-3 text-xs text-gray-500">
              A <code>201</code> response means the lead was created. Check the{" "}
              <strong>Leads</strong> page to confirm.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
