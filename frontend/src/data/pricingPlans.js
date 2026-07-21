export const monthlyPlans = [
    {
      name: "Starter",
      price: 19,
      description: "Perfect for freelancers and startups.",
      popular: false,
      button: "Start Free Trial",
      features: [
        "300 AI invoices / month",
        "AI OCR Extraction",
        "Manual Invoice Editing",
        "Client Management",
        "Excel Export",
        "Email Support",
        "1 Company"
      ]
    },
  
    {
      name: "Growth",
      price: 49,
      description: "Ideal for growing businesses.",
      popular: true,
      button: "Choose Growth",
      features: [
        "2,000 AI invoices / month",
        "Unlimited Users",
        "Bulk Upload",
        "Zoho Export",
        "QuickBooks Export",
        "Xero Export",
        "Analytics",
        "Priority Support"
      ]
    },
  
    {
      name: "Business",
      price: 99,
      description: "Designed for finance teams.",
      popular: false,
      button: "Choose Business",
      features: [
        "10,000 AI invoices",
        "Approval Workflow",
        "Duplicate Detection",
        "Audit Logs",
        "API Access",
        "Role Management",
        "Email Automation",
        "WhatsApp Upload"
      ]
    },
  
    {
      name: "Enterprise",
      price: "Custom",
      description: "Tailored for large organizations.",
      popular: false,
      button: "Contact Sales",
      features: [
        "Unlimited Invoices",
        "Dedicated Server",
        "Custom Integrations",
        "SSO Login",
        "Priority SLA",
        "Dedicated Manager",
        "ERP Integration",
        "White Label"
      ]
    }
  ];
  
  export const yearlyPlans = monthlyPlans.map(plan => ({
    ...plan,
    price:
      typeof plan.price === "number"
        ? Math.round(plan.price * 0.8)
        : "Custom"
  }));