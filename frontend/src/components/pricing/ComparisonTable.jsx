import { Fragment } from "react";
import { Check, Minus } from "lucide-react";

const features = [
  {
    category: "Invoice Processing",
    items: [
      {
        name: "AI OCR Invoice Extraction",
        starter: true,
        growth: true,
        business: true,
        enterprise: true,
      },
      {
        name: "PDF & Image Upload",
        starter: true,
        growth: true,
        business: true,
        enterprise: true,
      },
      {
        name: "Bulk Upload",
        starter: false,
        growth: true,
        business: true,
        enterprise: true,
      },
      {
        name: "Multi-page PDF Support",
        starter: true,
        growth: true,
        business: true,
        enterprise: true,
      },
      {
        name: "Duplicate Detection",
        starter: false,
        growth: false,
        business: true,
        enterprise: true,
      },
      {
        name: "Manual Invoice Editing",
        starter: true,
        growth: true,
        business: true,
        enterprise: true,
      },
    ],
  },

  {
    category: "Clients",

    items: [
      {
        name: "Client Management",
        starter: true,
        growth: true,
        business: true,
        enterprise: true,
      },

      {
        name: "Unlimited Clients",
        starter: false,
        growth: true,
        business: true,
        enterprise: true,
      },

      {
        name: "Client Portal",
        starter: false,
        growth: false,
        business: true,
        enterprise: true,
      },
    ],
  },

  {
    category: "Exports",

    items: [
      {
        name: "Excel Export",
        starter: true,
        growth: true,
        business: true,
        enterprise: true,
      },

      {
        name: "Zoho Books Export",
        starter: false,
        growth: true,
        business: true,
        enterprise: true,
      },

      {
        name: "QuickBooks Export",
        starter: false,
        growth: true,
        business: true,
        enterprise: true,
      },

      {
        name: "Xero Export",
        starter: false,
        growth: true,
        business: true,
        enterprise: true,
      },
    ],
  },

  {
    category: "Automation",

    items: [
      {
        name: "Email Upload",
        starter: false,
        growth: true,
        business: true,
        enterprise: true,
      },

      {
        name: "WhatsApp Upload",
        starter: false,
        growth: false,
        business: true,
        enterprise: true,
      },

      {
        name: "Approval Workflow",
        starter: false,
        growth: false,
        business: true,
        enterprise: true,
      },

      {
        name: "Auto Categorization",
        starter: false,
        growth: true,
        business: true,
        enterprise: true,
      },
    ],
  },

  {
    category: "Security",

    items: [
      {
        name: "SSL Encryption",
        starter: true,
        growth: true,
        business: true,
        enterprise: true,
      },

      {
        name: "Role Permissions",
        starter: false,
        growth: false,
        business: true,
        enterprise: true,
      },

      {
        name: "Audit Logs",
        starter: false,
        growth: false,
        business: true,
        enterprise: true,
      },

      {
        name: "Single Sign-On",
        starter: false,
        growth: false,
        business: false,
        enterprise: true,
      },
    ],
  },
];

function Cell({ value }) {
  return (
    <td className="border-b border-slate-800 py-5 text-center">
      {value ? (
        <Check className="mx-auto text-green-400" size={18} />
      ) : (
        <Minus className="mx-auto text-slate-600" size={18} />
      )}
    </td>
  );
}

export default function ComparisonTable() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-28">

      <div className="mb-12 text-center">

        <h2 className="text-5xl font-bold">
          Compare every feature
        </h2>

        <p className="mt-5 text-slate-400 text-lg">
          Everything included in every pricing plan.
        </p>

      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">

        <table className="w-full min-w-[950px]">

          <thead className="sticky top-0 bg-slate-950">

            <tr>

              <th className="text-left px-8 py-6 text-xl">
                Features
              </th>

              <th className="text-center">
                Starter
              </th>

              <th className="text-center text-blue-400">
                Growth
              </th>

              <th className="text-center">
                Business
              </th>

              <th className="text-center">
                Enterprise
              </th>

            </tr>

          </thead>

          <tbody>

            {features.map((group) => (
              <Fragment key={group.category}>
                <tr className="bg-slate-950">
                  <td
                    colSpan={5}
                    className="px-8 py-5 text-lg font-bold text-blue-400"
                  >
                    {group.category}
                  </td>
                </tr>

                {group.items.map((feature) => (
                  <tr
                    key={feature.name}
                    className="hover:bg-slate-800/40 transition"
                  >
                    <td className="px-8 py-5 border-b border-slate-800">
                      {feature.name}
                    </td>

                    <Cell value={feature.starter} />
                    <Cell value={feature.growth} />
                    <Cell value={feature.business} />
                    <Cell value={feature.enterprise} />
                  </tr>
                ))}
              </Fragment>
            ))}

          </tbody>

        </table>

      </div>

    </section>
  );
}