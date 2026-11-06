export type FieldCategory = "contact" | "identity" | "tax" | "banking" | "documents";

export interface LibraryFieldDef {
  key: string;
  label: string;
  description?: string;
  input_type:
    | "text"
    | "number"
    | "email"
    | "phone"
    | "date"
    | "dropdown"
    | "multiselect"
    | "checkbox"
    | "radio"
    | "file";
  required_default: boolean;
  options?: string[];
  config?: Record<string, unknown>;
}

export interface FieldCategoryDef {
  id: FieldCategory;
  name: string;
  fields: LibraryFieldDef[];
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const FIELD_LIBRARY: FieldCategoryDef[] = [
  {
    id: "contact",
    name: "Contact",
    fields: [
      { key: "display_name", label: "Display Name", input_type: "text", required_default: true },
      {
        key: "legal_contact_name",
        label: "Legal Contact Name",
        input_type: "text",
        required_default: false,
      },
      {
        key: "primary_contact_person",
        label: "Primary Contact Person",
        input_type: "text",
        required_default: true,
      },
      {
        key: "secondary_contact_person",
        label: "Secondary Contact Person",
        input_type: "text",
        required_default: false,
      },
      {
        key: "primary_contact_email",
        label: "Primary Contact Email",
        input_type: "email",
        required_default: true,
      },
      {
        key: "secondary_contact_email",
        label: "Secondary Contact Email",
        input_type: "email",
        required_default: false,
      },
      {
        key: "default_invoice_email",
        label: "Default Invoice Email",
        input_type: "email",
        required_default: false,
      },
      {
        key: "primary_phone",
        label: "Primary Phone Number",
        input_type: "phone",
        required_default: true,
      },
      {
        key: "secondary_phone",
        label: "Secondary Phone Number",
        input_type: "phone",
        required_default: false,
      },
      { key: "website", label: "Website", input_type: "text", required_default: false },
    ],
  },
  {
    id: "identity",
    name: "Identity",
    fields: [
      {
        key: "legal_business_name",
        label: "Legal Business Name",
        input_type: "text",
        required_default: true,
      },
      { key: "trade_name", label: "Trade Name", input_type: "text", required_default: false },
      {
        key: "business_type",
        label: "Business Type",
        input_type: "dropdown",
        required_default: true,
        options: [
          "Proprietorship",
          "Partnership",
          "LLP",
          "Private Limited",
          "Public Limited",
          "HUF",
          "Society / Trust",
          "Other",
        ],
      },
      {
        key: "pan",
        label: "PAN",
        description: "10-character Permanent Account Number",
        input_type: "text",
        required_default: true,
      },
      {
        key: "registered_address",
        label: "Registered Address",
        input_type: "text",
        required_default: true,
      },
      { key: "city", label: "Place / City", input_type: "text", required_default: true },
      {
        key: "state",
        label: "State",
        input_type: "dropdown",
        required_default: true,
        options: [...INDIAN_STATES],
      },
      {
        key: "pin_code",
        label: "PIN Code",
        description: "6-digit Indian postal PIN code",
        input_type: "text",
        required_default: true,
      },
      {
        key: "country",
        label: "Country",
        description: "India only in this version",
        input_type: "dropdown",
        required_default: true,
        options: ["India"],
      },
    ],
  },
  {
    id: "tax",
    name: "Tax Details",
    fields: [
      {
        key: "gstin",
        label: "GSTIN",
        description: "15-character Goods and Services Tax Identification Number",
        input_type: "text",
        required_default: false,
      },
      {
        key: "gst_registration_type",
        label: "GST Registration Type",
        input_type: "dropdown",
        required_default: false,
        options: ["Regular", "Composition", "Unregistered", "Consumer", "Unknown"],
      },
      {
        key: "tax_preference",
        label: "Tax Preference",
        input_type: "dropdown",
        required_default: false,
        options: ["Taxable", "Tax Exempt", "Out of Scope", "Other"],
      },
      {
        key: "composition_scheme",
        label: "Composition Scheme Status",
        description: "Is the vendor registered under the composition scheme?",
        input_type: "checkbox",
        required_default: false,
      },
      {
        key: "gst_certificate",
        label: "GST Registration Certificate",
        input_type: "file",
        required_default: false,
      },
      {
        key: "lut_documents",
        label: "LUT / Tax Exemption Documents",
        description: "Letter of Undertaking or exemption documents, where applicable",
        input_type: "file",
        required_default: false,
      },
    ],
  },
  {
    id: "banking",
    name: "Banking Details",
    fields: [
      {
        key: "account_holder_name",
        label: "Account Holder Name",
        input_type: "text",
        required_default: true,
      },
      { key: "bank_name", label: "Bank Name", input_type: "text", required_default: true },
      {
        key: "account_number",
        label: "Account Number",
        input_type: "text",
        required_default: true,
      },
      {
        key: "confirm_account_number",
        label: "Confirm Account Number",
        description: "Re-enter the account number exactly",
        input_type: "text",
        required_default: true,
      },
      {
        key: "ifsc",
        label: "IFSC",
        description: "11-character IFSC code",
        input_type: "text",
        required_default: true,
      },
      {
        key: "account_type",
        label: "Account Type",
        input_type: "dropdown",
        required_default: true,
        options: ["Current", "Savings", "Cash Credit", "Overdraft", "Other"],
      },
      {
        key: "cancelled_cheque",
        label: "Cancelled Cheque / Bank Proof",
        input_type: "file",
        required_default: true,
      },
    ],
  },
  {
    id: "documents",
    name: "Documents & Reports",
    fields: [
      { key: "pan_proof", label: "PAN Proof", input_type: "file", required_default: false },
      {
        key: "gst_certificate_doc",
        label: "GST Registration Certificate",
        input_type: "file",
        required_default: false,
      },
      {
        key: "certificate_incorporation",
        label: "Certificate of Incorporation",
        input_type: "file",
        required_default: false,
      },
      {
        key: "trade_licence",
        label: "Business / Trade Licence",
        input_type: "file",
        required_default: false,
      },
      {
        key: "other_licences",
        label: "Other Licences",
        description: "e.g. FSSAI, drug, factory, pollution control or import-export (IEC) licences",
        input_type: "file",
        required_default: false,
      },
      {
        key: "quality_certificates",
        label: "Quality Certificates",
        description: "e.g. ISO 9001, BIS, CE",
        input_type: "file",
        required_default: false,
      },
      {
        key: "quality_inspection_reports",
        label: "Quality Check Scans / Inspection Reports",
        description: "Scanned quality-check or inspection reports",
        input_type: "file",
        required_default: false,
      },
      {
        key: "business_reports",
        label: "Recent Reports",
        description: "e.g. latest audited financials or annual report",
        input_type: "file",
        required_default: false,
      },
      {
        key: "other_documents",
        label: "Other Supporting Documents",
        input_type: "file",
        required_default: false,
      },
    ],
  },
];

export const DEFAULT_SECTIONS: { title: string; categories: FieldCategory[] }[] = [
  { title: "Contact Details", categories: ["contact"] },
  { title: "Business Identity", categories: ["identity"] },
  { title: "Tax Details", categories: ["tax"] },
  { title: "Banking Details", categories: ["banking"] },
  { title: "Documents & Reports", categories: ["documents"] },
];

/** Auto validation rules applied when these canonical fields are present. */
export const AUTO_VALIDATED_KEYS = ["pan", "gstin", "ifsc", "pin_code", "primary_phone"] as const;

export const ACCEPTED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

/** Fields a brand-new form starts with (the company can add or remove anything afterwards). */
export const STARTER_FIELD_KEYS = [
  "display_name",
  "primary_contact_person",
  "primary_contact_email",
  "primary_phone",
  "secondary_contact_person",
  "secondary_contact_email",
  "default_invoice_email",
  "legal_business_name",
  "business_type",
  "pan",
  "registered_address",
  "city",
  "state",
  "pin_code",
  "gstin",
  "gst_registration_type",
  "tax_preference",
  "account_holder_name",
  "bank_name",
  "account_number",
  "confirm_account_number",
  "ifsc",
  "account_type",
  "cancelled_cheque",
  "pan_proof",
  "gst_certificate_doc",
  "trade_licence",
  "quality_inspection_reports",
  "business_reports",
];

export function findLibraryField(
  key: string,
): (LibraryFieldDef & { category: FieldCategory }) | undefined {
  for (const cat of FIELD_LIBRARY) {
    const f = cat.fields.find((x) => x.key === key);
    if (f) return { ...f, category: cat.id };
  }
  return undefined;
}
