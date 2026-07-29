import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
} from "lucide-react";

import api from "../../services/api";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const registerSchema = z
  .object({
    fullName: z.string().min(3, "Full name is required"),

    company: z.string().optional(),

    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email"),

    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain number"),

    confirmPassword: z.string(),

    terms: z.boolean().refine((val) => val === true, {
      message: "Please accept Terms & Conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const password = watch("password") || "";

  const strength = () => {
    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;

    return score;
  };

  const passwordStrength = strength();

  const onSubmit = async (data) => {

 
    try {
      const response = await api.post("/auth/register", {
        name: data.fullName,
        company_name: data.company,
        email: data.email,
        password: data.password,
      });
 
      if (response.data.success) {
        toast.success("Account Created Successfully");
  
        navigate("/login");
      }
    } catch (error) {

     
      toast.error(
        error.response?.data?.error ||
        "Registration Failed"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Full Name */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Full Name
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4">

          <User size={20} className="text-slate-500" />

          <input
            {...register("fullName")}
            placeholder="John Doe"
            className="w-full bg-transparent px-4 py-4 outline-none"
          />

        </div>

        {errors.fullName && (
          <p className="mt-2 text-sm text-red-400">
            {errors.fullName.message}
          </p>
        )}

      </div>

      {/* Company */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Company (Optional)
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4">

          <Building2 size={20} className="text-slate-500" />

          <input
            {...register("company")}
            placeholder="EazeeBooks Inc."
            className="w-full bg-transparent px-4 py-4 outline-none"
          />

        </div>

      </div>

      {/* Email */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Email Address
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4">

          <Mail size={20} className="text-slate-500" />

          <input
            type="email"
            {...register("email")}
            placeholder="john@example.com"
            className="w-full bg-transparent px-4 py-4 outline-none"
          />

        </div>

        {errors.email && (
          <p className="mt-2 text-sm text-red-400">
            {errors.email.message}
          </p>
        )}

      </div>

      {/* Password */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Password
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4">

          <Lock size={20} className="text-slate-500" />

          <input
            type={showPassword ? "text" : "password"}
            {...register("password")}
            placeholder="Password"
            className="w-full bg-transparent px-4 py-4 outline-none"
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>

        </div>

        {errors.password && (
          <p className="mt-2 text-sm text-red-400">
            {errors.password.message}
          </p>
        )}

        {/* Password Strength */}

        <div className="mt-3">

          <div className="flex gap-2">

            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className={`h-2 flex-1 rounded-full ${
                  passwordStrength >= item
                    ? "bg-green-500"
                    : "bg-slate-700"
                }`}
              />
            ))}

          </div>

          <p className="mt-2 text-xs text-slate-400">

            Password Strength :

            {passwordStrength === 1 && " Weak"}

            {passwordStrength === 2 && " Fair"}

            {passwordStrength === 3 && " Good"}

            {passwordStrength === 4 && " Strong"}

          </p>

        </div>

      </div>

      {/* Confirm Password */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Confirm Password
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4">

          <Lock size={20} className="text-slate-500" />

          <input
            type={showConfirm ? "text" : "password"}
            {...register("confirmPassword")}
            placeholder="Confirm Password"
            className="w-full bg-transparent px-4 py-4 outline-none"
          />

          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
          >
            {showConfirm ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>

        </div>

        {errors.confirmPassword && (
          <p className="mt-2 text-sm text-red-400">
            {errors.confirmPassword.message}
          </p>
        )}

      </div>

      {/* Terms */}

      <label className="flex items-start gap-3 text-sm text-slate-400">

        <input
          type="checkbox"
          {...register("terms")}
          className="mt-1"
        />

        <span>
          I agree to the Terms of Service and Privacy Policy.
        </span>

      </label>

      {errors.terms && (
        <p className="text-sm text-red-400">
          {errors.terms.message}
        </p>
      )}

      {/* Benefits */}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">

        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle size={18} />
          Free 14-day trial
        </div>

        <div className="mt-2 flex items-center gap-2 text-green-400">
          <CheckCircle size={18} />
          Unlimited Invoice Processing
        </div>

        <div className="mt-2 flex items-center gap-2 text-green-400">
          <CheckCircle size={18} />
          AI OCR Included
        </div>

      </div>

      {/* Submit */}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-4 font-semibold transition hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Creating Account..." : "Create Account"}
      </button>

      <p className="text-center text-slate-400">

        Already have an account?

        <Link
          to="/login"
          className="ml-2 font-medium text-blue-400 hover:text-blue-300"
        >
          Sign In
        </Link>

      </p>

    </form>
  );
}