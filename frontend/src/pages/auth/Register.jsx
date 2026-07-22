import AuthLayout from "../../layouts/AuthLayout";
import RegisterForm from "../../components/auth/RegisterForm";

export default function Register() {
  return (
    <AuthLayout
      title="Create Account"
      subtitle="Start using EazeeBooks today."
    >
      <RegisterForm />
    </AuthLayout>
  );
}