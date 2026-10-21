import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "rw" | "en" | "fr";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "rw", label: "Kinyarwanda" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

type Dict = Record<string, [rw: string, en: string, fr: string]>;

const D: Dict = {
  welcome: ["Murakaza neza kuri K POINT BAR", "Welcome to K POINT BAR", "Bienvenue à K POINT BAR"],
  subtitle: ["Sisitemu yo gucunga ububiko n'igurisha", "Inventory & Sales Management System", "Système de gestion des stocks et des ventes"],
  username: ["Izina ukoresha", "Username", "Nom d'utilisateur"],
  password: ["Ijambo ry'ibanga", "Password", "Mot de passe"],
  signIn: ["Injira", "Sign In", "Se connecter"],
  signingIn: ["Kwinjira...", "Signing in...", "Connexion..."],
  signOut: ["Sohoka", "Sign out", "Se déconnecter"],
  forgot: ["Wibagiwe ijambo ry'ibanga?", "Forgot password?", "Mot de passe oublié ?"],
  forgotMsg: ["Vugana n'umuyobozi (Super Admin) kugira ngo agusubirize ijambo ry'ibanga.", "Contact your Super Admin to reset your password. For security, we never confirm whether an account exists.", "Contactez votre Super Admin pour réinitialiser votre mot de passe. Par sécurité, nous ne confirmons jamais l'existence d'un compte."],
  invalidCreds: ["Izina cyangwa ijambo ry'ibanga si byo", "Invalid username or password", "Identifiants invalides"],
  required: ["Iki gisabwa", "This field is required", "Ce champ est requis"],
  show: ["Erekana", "Show", "Afficher"],
  hide: ["Hisha", "Hide", "Masquer"],
  remember: ["Unyibuke", "Remember me", "Se souvenir de moi"],
  accountInactive: ["Konti yawe yahagaritswe", "Your account is deactivated", "Votre compte est désactivé"],
  // password change
  changePassword: ["Hindura ijambo ry'ibanga", "Change password", "Changer le mot de passe"],
  mustChange: ["Ugomba guhindura ijambo ry'ibanga mbere yo gukomeza.", "You must change your initial password before continuing.", "Vous devez changer votre mot de passe initial avant de continuer."],
  currentPassword: ["Ijambo ry'ibanga risanzwe", "Current password", "Mot de passe actuel"],
  newPassword: ["Ijambo ry'ibanga rishya", "New password", "Nouveau mot de passe"],
  confirmPassword: ["Emeza ijambo ry'ibanga", "Confirm password", "Confirmer le mot de passe"],
  pwRules: ["Nibura inyuguti 10, harimo inyuguti nkuru, nto n'umubare", "At least 10 characters with upper, lower case and a number", "Au moins 10 caractères avec majuscule, minuscule et chiffre"],
  pwMismatch: ["Amagambo y'ibanga ntahura", "Passwords do not match", "Les mots de passe ne correspondent pas"],
  pwChanged: ["Ijambo ry'ibanga ryahinduwe", "Password changed", "Mot de passe modifié"],
  chooseLanguage: ["Hitamo ururimi", "Choose your language", "Choisissez votre langue"],
  language: ["Ururimi", "Language", "Langue"],
  continue: ["Komeza", "Continue", "Continuer"],
  // nav
  dashboard: ["Ikibaho", "Dashboard", "Tableau de bord"],
  inventory: ["Ububiko", "Inventory", "Inventaire"],
  drinks: ["Ibinyobwa", "Drinks", "Boissons"],
  kitchen: ["Igikoni", "Kitchen", "Cuisine"],
  sales: ["Igurisha", "Sales", "Ventes"],
  closing: ["Gufunga umunsi", "Daily Closing", "Clôture journalière"],
  purchases: ["Ibyaguzwe", "Purchases", "Achats"],
  suppliers: ["Abatanga ibicuruzwa", "Suppliers", "Fournisseurs"],
  expenses: ["Amafaranga yakoreshejwe", "Expenses", "Dépenses"],
  income: ["Andi mafaranga yinjiye", "Room & Other Income", "Chambres et autres revenus"],
  reports: ["Raporo", "Reports", "Rapports"],
  alerts: ["Imenyesha", "Alerts", "Alertes"],
  employees: ["Abakozi", "Employees", "Employés"],
  audit: ["Igenzura", "Audit Logs", "Journal d'audit"],
  settings: ["Igenamiterere", "Settings", "Paramètres"],
  profile: ["Umwirondoro", "Profile", "Profil"],
  // common
  save: ["Bika", "Save", "Enregistrer"],
  cancel: ["Reka", "Cancel", "Annuler"],
  add: ["Ongeraho", "Add", "Ajouter"],
  edit: ["Hindura", "Edit", "Modifier"],
  delete: ["Siba", "Delete", "Supprimer"],
  search: ["Shakisha", "Search", "Rechercher"],
  actions: ["Ibikorwa", "Actions", "Actions"],
  status: ["Imimerere", "Status", "Statut"],
  date: ["Itariki", "Date", "Date"],
  from: ["Kuva", "From", "Du"],
  to: ["Kugeza", "To", "Au"],
  total: ["Igiteranyo", "Total", "Total"],
  amount: ["Amafaranga", "Amount", "Montant"],
  description: ["Ibisobanuro", "Description", "Description"],
  category: ["Icyiciro", "Category", "Catégorie"],
  notes: ["Ibisobanuro", "Notes", "Notes"],
  reason: ["Impamvu", "Reason", "Raison"],
  product: ["Igicuruzwa", "Product", "Produit"],
  quantity: ["Ingano", "Quantity", "Quantité"],
  unit: ["Igipimo", "Unit", "Unité"],
  price: ["Igiciro", "Price", "Prix"],
  costPrice: ["Igiciro cyo kugura", "Purchase cost", "Coût d'achat"],
  sellingPrice: ["Igiciro cyo kugurisha", "Selling price", "Prix de vente"],
  stock: ["Ibiri mu bubiko", "Stock", "Stock"],
  minStock: ["Ingano ntoya", "Min. stock", "Stock min."],
  stockValue: ["Agaciro k'ububiko", "Stock value", "Valeur du stock"],
  paymentMethod: ["Uburyo bwo kwishyura", "Payment method", "Mode de paiement"],
  reference: ["Indango", "Reference", "Référence"],
  noData: ["Nta makuru ahari", "No data yet", "Aucune donnée"],
  notSet: ["Ntibirashyirwaho", "Not set", "Non défini"],
  loading: ["Birimo gufunguka...", "Loading...", "Chargement..."],
  saved: ["Byabitswe", "Saved", "Enregistré"],
  all: ["Byose", "All", "Tous"],
  today: ["Uyu munsi", "Today", "Aujourd'hui"],
  approve: ["Emeza", "Approve", "Approuver"],
  reject: ["Anga", "Reject", "Rejeter"],
  returnForCorrection: ["Garura ngo gikosorwe", "Return for correction", "Renvoyer pour correction"],
  reopen: ["Ongera ufungure", "Reopen", "Rouvrir"],
  pending: ["Bitegereje", "Pending", "En attente"],
  approved: ["Byemejwe", "Approved", "Approuvé"],
  rejected: ["Byanzwe", "Rejected", "Rejeté"],
  submitted: ["Byoherejwe", "Submitted", "Soumis"],
  returned: ["Byagaruwe", "Returned", "Renvoyé"],
  draft: ["Igishushanyo", "Draft", "Brouillon"],
  received: ["Byakiriwe", "Received", "Reçu"],
  active: ["Irakora", "Active", "Actif"],
  inactive: ["Yahagaritswe", "Inactive", "Inactif"],
  // dashboard
  todaySales: ["Igurisha ry'uyu munsi", "Today's sales", "Ventes du jour"],
  grossProfit: ["Inyungu mbumbe", "Est. gross profit", "Marge brute est."],
  netProfit: ["Inyungu nyayo", "Est. net profit", "Bénéfice net est."],
  lowStock: ["Ibiri hafi gushira", "Low stock", "Stock faible"],
  outOfStock: ["Byashize", "Out of stock", "Rupture"],
  pendingReports: ["Raporo zitegereje", "Pending reports", "Rapports en attente"],
  cashDiff: ["Ikinyuranyo cy'amafaranga", "Cash discrepancies", "Écarts de caisse"],
  salesTrend: ["Uko igurisha rigenda", "Sales trend (14 days)", "Tendance des ventes (14 j)"],
  topProducts: ["Ibicuruzwa bigurishwa cyane", "Top products", "Meilleurs produits"],
  categorySales: ["Igurisha ku cyiciro", "Sales by category", "Ventes par catégorie"],
  // sales
  newSale: ["Igurisha rishya", "New sale", "Nouvelle vente"],
  addItem: ["Ongeraho igicuruzwa", "Add item", "Ajouter un article"],
  recordSale: ["Andika igurisha", "Record sale", "Enregistrer la vente"],
  saleRecorded: ["Igurisha ryanditswe", "Sale recorded", "Vente enregistrée"],
  recentSales: ["Igurisha riheruka", "Recent sales", "Ventes récentes"],
  // inventory
  adjustStock: ["Hindura ububiko", "Adjust stock", "Ajuster le stock"],
  adjustType: ["Ubwoko", "Type", "Type"],
  opening: ["Itangiriro", "Opening", "Ouverture"],
  adjustment: ["Ihinduka", "Adjustment", "Ajustement"],
  wastage: ["Ibyangiritse", "Wastage", "Perte"],
  history: ["Amateka", "History", "Historique"],
  newProduct: ["Igicuruzwa gishya", "New product", "Nouveau produit"],
  archive: ["Shyira mu bubiko bw'amateka", "Archive", "Archiver"],
  // purchases
  newPurchase: ["Kugura gushya", "New purchase", "Nouvel achat"],
  supplier: ["Utanga ibicuruzwa", "Supplier", "Fournisseur"],
  invoice: ["Inyemezabuguzi", "Invoice no.", "N° facture"],
  paymentStatus: ["Imimerere yo kwishyura", "Payment status", "Statut de paiement"],
  confirmReceipt: ["Emeza ko byakiriwe", "Confirm receipt", "Confirmer la réception"],
  unitCost: ["Igiciro kimwe", "Unit cost", "Coût unitaire"],
  phone: ["Telefone", "Phone", "Téléphone"],
  name: ["Izina", "Name", "Nom"],
  // closing
  instock: ["IBIHARI", "INSTOCK", "EN STOCK"],
  purchased: ["BYAGUZWE", "PURCHASED", "ACHETÉ"],
  stAftSales: ["NYUMA Y'IGURISHA", "ST AFT SALES", "ST APRÈS VENTE"],
  sold: ["BYAGURISHIJWE", "SOLD", "VENDU"],
  pUnit: ["IGICIRO", "P UNIT", "P UNIT"],
  pTotal: ["IGITERANYO", "P TOTAL", "P TOTAL"],
  physical: ["Ibibaruwe", "Physical", "Physique"],
  variance: ["Ikinyuranyo", "Variance", "Écart"],
  cashCounted: ["Amafaranga abaruwe", "Cash counted", "Espèces comptées"],
  cashExpected: ["Amafaranga ateganyijwe", "Cash expected", "Espèces attendues"],
  submitReport: ["Ohereza raporo", "Submit report", "Soumettre le rapport"],
  reportSubmitted: ["Raporo yoherejwe", "Report submitted", "Rapport soumis"],
  totalDrinks: ["Igiteranyo cy'ibinyobwa", "Total drinks", "Total boissons"],
  totalKitchen: ["Igiteranyo cy'igikoni", "Total kitchen", "Total cuisine"],
  totalSales: ["Igurisha ryose", "Total sales", "Ventes totales"],
  cogs: ["Ikiguzi cy'ibyagurishijwe", "Cost of goods sold", "Coût des ventes"],
  reportLocked: ["Iyi raporo yaremejwe, ntishobora guhindurwa.", "This report is approved and locked.", "Ce rapport est approuvé et verrouillé."],
  adminComment: ["Igitekerezo cy'umuyobozi", "Admin comment", "Commentaire admin"],
  // reports
  period: ["Igihe", "Period", "Période"],
  daily: ["Buri munsi", "Daily", "Journalier"],
  weekly: ["Buri cyumweru", "Weekly", "Hebdomadaire"],
  monthly: ["Buri kwezi", "Monthly", "Mensuel"],
  yearly: ["Buri mwaka", "Yearly", "Annuel"],
  custom: ["Wihitiremo", "Custom", "Personnalisé"],
  reportType: ["Ubwoko bwa raporo", "Report type", "Type de rapport"],
  summary: ["Incamake", "Summary", "Résumé"],
  productPerformance: ["Uko ibicuruzwa byitwaye", "Product performance", "Performance produits"],
  stockBalances: ["Ibiri mu bubiko", "Stock balances", "Soldes de stock"],
  stockMovements: ["Ihinduka ry'ububiko", "Stock movements", "Mouvements de stock"],
  employeeActivity: ["Ibikorwa by'abakozi", "Employee activity", "Activité des employés"],
  download: ["Kuramo", "Download", "Télécharger"],
  // employees
  newEmployee: ["Umukozi mushya", "New employee", "Nouvel employé"],
  fullName: ["Amazina yose", "Full name", "Nom complet"],
  role: ["Uruhare", "Role", "Rôle"],
  superAdmin: ["Umuyobozi mukuru", "Super Admin", "Super Admin"],
  salesManager: ["Ushinzwe igurisha", "Sales Manager", "Responsable des ventes"],
  permReceive: ["Yakira ibicuruzwa", "Can receive stock", "Peut réceptionner"],
  permExpenses: ["Yandika amafaranga yakoreshejwe", "Can record expenses", "Peut saisir les dépenses"],
  permExport: ["Akuramo raporo", "Can export reports", "Peut exporter"],
  resetPassword: ["Subiramo ijambo ry'ibanga", "Reset password", "Réinitialiser le mot de passe"],
  tempPassword: ["Ijambo ry'ibanga ry'agateganyo", "Temporary password", "Mot de passe temporaire"],
  deactivate: ["Hagarika", "Deactivate", "Désactiver"],
  activate: ["Ongera ukoreshe", "Activate", "Activer"],
  // income
  room: ["Icyumba", "Room", "Chambre"],
  other: ["Ibindi", "Other", "Autre"],
  source: ["Inkomoko", "Source", "Source"],
  businessName: ["Izina ry'ubucuruzi", "Business name", "Nom de l'entreprise"],
  currency: ["Ifaranga", "Currency", "Devise"],
  address: ["Aderesi", "Address", "Adresse"],
  user: ["Ukoresha", "User", "Utilisateur"],
  details: ["Ibisobanuro birambuye", "Details", "Détails"],
  noPermission: ["Nta burenganzira ufite", "You don't have permission", "Vous n'avez pas la permission"],
};

const idx: Record<Lang, number> = { rw: 0, en: 1, fr: 2 };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const s = localStorage.getItem("kpb-lang") as Lang | null;
    if (s && s in idx) setLangState(s);
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("kpb-lang", l);
    document.documentElement.lang = l === "rw" ? "rw" : l;
  }, []);
  const t = useCallback((k: string) => D[k]?.[idx[lang]] ?? k, [lang]);
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
