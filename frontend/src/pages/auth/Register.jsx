import AuthLayout from "../../layouts/AuthLayout";
import RegisterForm from "../../components/auth/RegisterForm";
import { useSeo } from "../../hooks/useSeo";

export default function Register() {
  useSeo({
    title: "Create Account",
    description: "Create your free EazeeBooks account.",
    path: "/register",
    robots: "noindex, nofollow",
  });

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Start using EazeeBooks today."
    >
      <RegisterForm />
    </AuthLayout>
  );
}