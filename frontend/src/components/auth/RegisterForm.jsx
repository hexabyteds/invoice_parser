import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  Building2,
  Briefcase,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  Globe,
  Phone,
} from "lucide-react";

import api from "../../services/api";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { COUNTRIES, getCountryByName } from "../../constants/countries";

const registerSchema = z
  .object({
    accountType: z.enum(["COMPANY", "FREELANCER"], {
      required_error: "Please choose an account type",
    }),

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

    country: z.string().trim().min(1, "Country is required."),

    mobileNumber: z
      .string()
      .trim()
      .min(1, "Mobile number is required.")
      .refine(
        (val) => /^[0-9\-\s()]+$/.test(val),
        "Mobile number contains invalid characters."
      )
      .refine((val) => {
        const digits = val.replace(/\D/g, "");
        return digits.length >= 6 && digits.length <= 14;
      }, "Please enter a valid mobile number."),

    terms: z.boolean().refine((val) => val === true, {
      message: "Please accept Terms & Conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  // A Company account owns a workspace and needs a name for it. A
  // Freelancer owns no workspace of their own (they manage companies
  // that invite them in), so the field doesn't apply — see
  // services/authService.js's register() for the matching backend rule.
  .refine(
    (data) => data.accountType !== "COMPANY" || !!data.company?.trim(),
    {
      message: "Company name is required for a Company account.",
      path: ["company"],
    }
  );

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { accountType: "COMPANY" },
  });

  const password = watch("password") || "";
  const selectedCountryName = watch("country") || "";
  const selectedCountry = getCountryByName(selectedCountryName);
  const accountType = watch("accountType");
  const isCompany = accountType === "COMPANY";

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
      const country = getCountryByName(data.country);

      const response = await api.post("/auth/register", {
        account_type: data.accountType,
        name: data.fullName,
        company_name: data.accountType === "COMPANY" ? data.company : null,
        email: data.email,
        password: data.password,
        country: data.country,
        country_code: country?.dialCode || "",
        mobile_number: data.mobileNumber,
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

      {/* Account Type */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Account Type
        </label>

        <div className="grid grid-cols-2 gap-3">

          <button
            type="button"
            onClick={() => setValue("accountType", "COMPANY", { shouldValidate: true })}
            aria-pressed={isCompany}
            className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
              isCompany
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-700 bg-slate-900 hover:border-slate-600"
            }`}
          >
            <Building2 size={20} className={isCompany ? "text-indigo-400" : "text-slate-500"} />
            <span className="font-medium">Company</span>
            <span className="text-xs text-slate-400">
              Owns and manages its own data
            </span>
          </button>

          <button
            type="button"
            onClick={() => setValue("accountType", "FREELANCER", { shouldValidate: true })}
            aria-pressed={!isCompany}
            className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
              !isCompany
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-700 bg-slate-900 hover:border-slate-600"
            }`}
          >
            <Briefcase size={20} className={!isCompany ? "text-indigo-400" : "text-slate-500"} />
            <span className="font-medium">Freelancer</span>
            <span className="text-xs text-slate-400">
              Manages other companies' books
            </span>
          </button>

        </div>

        {errors.accountType && (
          <p className="mt-2 text-sm text-red-400">
            {errors.accountType.message}
          </p>
        )}

      </div>

      {/* Full Name */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Full Name
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4 transition-colors focus-within:border-indigo-500">

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

      {/* Company — only meaningful for a Company account; a Freelancer
          owns no workspace of their own, so this doesn't apply to them. */}

      {isCompany && (
        <div>

          <label className="mb-2 block text-sm font-medium">
            Company Name
          </label>

          <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4 transition-colors focus-within:border-indigo-500">

            <Building2 size={20} className="text-slate-500" />

            <input
              {...register("company")}
              placeholder="Acme Trading LLC"
              className="w-full bg-transparent px-4 py-4 outline-none"
            />

          </div>

          {errors.company && (
            <p className="mt-2 text-sm text-red-400">
              {errors.company.message}
            </p>
          )}

        </div>
      )}

      {/* Country */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Country
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4">

          <Globe size={20} className="text-slate-500" />

          <select
            {...register("country")}
            defaultValue=""
            className="w-full bg-transparent px-4 py-4 outline-none [&>option]:bg-slate-900"
          >
            <option value="" disabled>
              Select Country
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

        </div>

        {errors.country && (
          <p className="mt-2 text-sm text-red-400">
            {errors.country.message}
          </p>
        )}

      </div>

      {/* Mobile Number */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Mobile Number
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4">

          <Phone size={20} className="text-slate-500" />

          <span className="ml-3 shrink-0 text-slate-300">
            {selectedCountry?.dialCode || "+--"}
          </span>

          <input
            type="tel"
            {...register("mobileNumber")}
            placeholder="3001234567"
            className="w-full bg-transparent px-4 py-4 outline-none"
          />

        </div>

        {errors.mobileNumber && (
          <p className="mt-2 text-sm text-red-400">
            {errors.mobileNumber.message}
          </p>
        )}

      </div>

      {/* Email */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Email Address
        </label>

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4 transition-colors focus-within:border-indigo-500">

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

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4 transition-colors focus-within:border-indigo-500">

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
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="-m-2 shrink-0 p-2 text-slate-500 transition-colors hover:text-white"
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

        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 px-4 transition-colors focus-within:border-indigo-500">

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
            aria-label={showConfirm ? "Hide password" : "Show password"}
            aria-pressed={showConfirm}
            className="-m-2 shrink-0 p-2 text-slate-500 transition-colors hover:text-white"
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
        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 font-semibold transition hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Creating Account..." : "Create Account"}
      </button>

      <p className="text-center text-slate-400">

        Already have an account?

        <Link
          to="/login"
          className="ml-2 font-medium text-indigo-400 transition-colors hover:text-indigo-300"
        >
          Sign In
        </Link>

      </p>

    </form>
  );
}