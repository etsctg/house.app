/* ============================================================================
   i18n.js — Dual-language engine (English / বাংলা)
   ----------------------------------------------------------------------------
   Usage:
     t('dashboard')            -> "Dashboard" or "ড্যাশবোর্ড" depending on I18N.lang
     I18N.setLang('bn')        -> switches language, persists to localStorage,
                                   re-applies all static [data-i18n] elements,
                                   and asks App to re-render the current view
                                   plus the nav (so dynamic template strings
                                   pick up the new language too).
   Every dynamically-built view (app.js / app-finance.js / app-reports.js /
   app-admin.js / app-inventory.js) calls the global t() helper instead of
   hardcoding English text, so switching language re-renders everything —
   nav, headers, buttons, table headers, statuses, and printed vouchers.
   User-entered free text (category names, descriptions, notice bodies,
   request text) is preserved exactly as typed — translating open-ended
   user content isn't something a static dictionary can safely do.
   ========================================================================= */

const I18N = {
  STORAGE_KEY: 'bms_lang',
  lang: 'en',

  DICT: {
    // ---- App-wide ----
    appName: { en: 'Building Management System', bn: 'বিল্ডিং ম্যানেজমেন্ট সিস্টেম' },
    offlineReady: { en: "Works fully offline. Data syncs automatically when you're back online.", bn: 'সম্পূর্ণ অফলাইনে কাজ করে। ইন্টারনেট সংযোগ ফিরে এলে ডেটা স্বয়ংক্রিয়ভাবে সিঙ্ক হয়।' },
    demoAccounts: { en: 'Demo accounts', bn: 'ডেমো অ্যাকাউন্ট' },

    // ---- Nav ----
    dashboard: { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
    notices: { en: 'Notices', bn: 'নোটিশ' },
    requests: { en: 'Requests', bn: 'অনুরোধ' },
    myLedger: { en: 'My Ledger', bn: 'আমার হিসাব' },
    incomeExpense: { en: 'Income / Expense', bn: 'আয় / ব্যয়' },
    collections: { en: 'Collections', bn: 'কালেকশন' },
    eventsFunds: { en: 'Events / Funds', bn: 'ইভেন্ট / তহবিল' },
    ownerLedger: { en: 'Owner Ledger', bn: 'মালিকের হিসাব' },
    reports: { en: 'Reports', bn: 'রিপোর্ট' },
    inventory: { en: 'Property & Assets', bn: 'সম্পত্তি ও সম্পদ' },
    categories: { en: 'Categories', bn: 'ক্যাটাগরি' },
    manageUsers: { en: 'Manage Users', bn: 'ব্যবহারকারী ব্যবস্থাপনা' },
    buildingSettings: { en: 'Building Settings', bn: 'ভবন সেটিংস' },
    auditLog: { en: 'Audit Log', bn: 'অডিট লগ' },
    myProfile: { en: 'My Profile', bn: 'আমার প্রোফাইল' },

    // ---- Auth / Login ----
    username: { en: 'Username', bn: 'ইউজারনেম' },
    password: { en: 'Password', bn: 'পাসওয়ার্ড' },
    signIn: { en: 'Sign In', bn: 'সাইন ইন' },
    logout: { en: 'Logout', bn: 'লগ আউট' },
    accountingSubtitle: { en: 'Accounting & Society Management — Offline Ready', bn: 'হিসাব ও সোসাইটি ব্যবস্থাপনা — অফলাইন প্রস্তুত' },

    // ---- Common actions ----
    save: { en: 'Save', bn: 'সংরক্ষণ করুন' },
    cancel: { en: 'Cancel', bn: 'বাতিল' },
    confirm: { en: 'Confirm', bn: 'নিশ্চিত করুন' },
    delete: { en: 'Delete', bn: 'মুছুন' },
    edit: { en: 'Edit', bn: 'সম্পাদনা' },
    add: { en: 'Add', bn: 'যোগ করুন' },
    close: { en: 'Close', bn: 'বন্ধ করুন' },
    search: { en: 'Search', bn: 'খুঁজুন' },
    filter: { en: 'Filter', bn: 'ফিল্টার' },
    print: { en: 'Print', bn: 'প্রিন্ট' },
    exportCsv: { en: 'Export CSV', bn: 'সিএসভি এক্সপোর্ট' },
    actions: { en: 'Actions', bn: 'কার্যক্রম' },
    viewAll: { en: 'View All', bn: 'সব দেখুন' },
    from: { en: 'From', bn: 'থেকে' },
    to: { en: 'To', bn: 'পর্যন্ত' },
    month: { en: 'Month', bn: 'মাস' },
    year: { en: 'Year', bn: 'বছর' },
    all: { en: 'All', bn: 'সব' },
    none: { en: 'None', bn: 'কিছুই না' },
    optional: { en: 'optional', bn: 'ঐচ্ছিক' },
    yes: { en: 'Yes', bn: 'হ্যাঁ' },
    no: { en: 'No', bn: 'না' },
    areYouSure: { en: 'Are you sure?', bn: 'আপনি কি নিশ্চিত?' },

    // ---- Fields / labels ----
    date: { en: 'Date', bn: 'তারিখ' },
    amount: { en: 'Amount', bn: 'পরিমাণ' },
    category: { en: 'Category', bn: 'ক্যাটাগরি' },
    description: { en: 'Description', bn: 'বিবরণ' },
    method: { en: 'Payment Method', bn: 'পেমেন্ট পদ্ধতি' },
    type: { en: 'Type', bn: 'ধরন' },
    status: { en: 'Status', bn: 'অবস্থা' },
    voucher: { en: 'Voucher', bn: 'ভাউচার' },
    name: { en: 'Name', bn: 'নাম' },
    phone: { en: 'Phone', bn: 'ফোন' },
    email: { en: 'Email', bn: 'ইমেইল' },
    role: { en: 'Role', bn: 'ভূমিকা' },
    flat: { en: 'Flat', bn: 'ফ্ল্যাট' },

    // ---- Transaction types / statuses ----
    income: { en: 'Income', bn: 'আয়' },
    expense: { en: 'Expense', bn: 'ব্যয়' },
    active: { en: 'Active', bn: 'সক্রিয়' },
    disabled: { en: 'Disabled', bn: 'নিষ্ক্রিয়' },
    pending: { en: 'Pending', bn: 'অপেক্ষমাণ' },
    approved: { en: 'Approved', bn: 'অনুমোদিত' },
    rejected: { en: 'Rejected', bn: 'প্রত্যাখ্যাত' },
    paid: { en: 'Paid', bn: 'পরিশোধিত' },
    partial: { en: 'Partial', bn: 'আংশিক' },
    settled: { en: 'Settled', bn: 'নিষ্পত্তি হয়েছে' },
    vacant: { en: 'Vacant', bn: 'খালি' },
    rented: { en: 'Rented', bn: 'ভাড়া দেওয়া' },
    ownerOccupied: { en: 'Owner Occupied', bn: 'মালিক নিজে থাকেন' },
    ongoing: { en: 'Ongoing', bn: 'চলমান' },
    planned: { en: 'Planned', bn: 'পরিকল্পিত' },
    completed: { en: 'Completed', bn: 'সম্পন্ন' },
    low: { en: 'Low', bn: 'কম' },
    medium: { en: 'Medium', bn: 'মাঝারি' },
    high: { en: 'High', bn: 'উচ্চ' },
    good: { en: 'Good', bn: 'ভালো' },
    needsRepair: { en: 'Needs Repair', bn: 'মেরামত প্রয়োজন' },
    damaged: { en: 'Damaged', bn: 'ক্ষতিগ্রস্ত' },

    // ---- Payment methods ----
    cash: { en: 'Cash', bn: 'নগদ' },
    bankTransfer: { en: 'Bank Transfer', bn: 'ব্যাংক ট্রান্সফার' },
    mobileBanking: { en: 'Mobile Banking', bn: 'মোবাইল ব্যাংকিং' },
    cheque: { en: 'Cheque', bn: 'চেক' },
    card: { en: 'Card', bn: 'কার্ড' },

    // ---- Roles ----
    roleUser: { en: 'Resident / Owner', bn: 'বাসিন্দা / মালিক' },
    roleEntry: { en: 'Entry User (Staff)', bn: 'এন্ট্রি ইউজার (স্টাফ)' },
    roleManager: { en: 'Manager / Admin', bn: 'ম্যানেজার / অ্যাডমিন' },
    roleSuperadmin: { en: 'Super Admin', bn: 'সুপার অ্যাডমিন' },

    // ---- Months ----
    m1: { en: 'January', bn: 'জানুয়ারি' }, m2: { en: 'February', bn: 'ফেব্রুয়ারি' },
    m3: { en: 'March', bn: 'মার্চ' }, m4: { en: 'April', bn: 'এপ্রিল' },
    m5: { en: 'May', bn: 'মে' }, m6: { en: 'June', bn: 'জুন' },
    m7: { en: 'July', bn: 'জুলাই' }, m8: { en: 'August', bn: 'আগস্ট' },
    m9: { en: 'September', bn: 'সেপ্টেম্বর' }, m10: { en: 'October', bn: 'অক্টোবর' },
    m11: { en: 'November', bn: 'নভেম্বর' }, m12: { en: 'December', bn: 'ডিসেম্বর' },

    // ---- Dashboard ----
    welcomeBack: { en: 'Welcome back', bn: 'স্বাগতম' },
    dashboardSubtitle: { en: "here's what's happening this month.", bn: 'এই মাসের সার্বিক অবস্থা।' },
    netBalance: { en: 'Net Balance', bn: 'নিট ব্যালেন্স' },
    thisMonthIncome: { en: 'This Month Income', bn: 'এই মাসের আয়' },
    thisMonthExpense: { en: 'This Month Expense', bn: 'এই মাসের ব্যয়' },
    outstandingDues: { en: 'Outstanding Dues', bn: 'বকেয়া' },
    totalFlats: { en: 'Total Flats', bn: 'মোট ফ্ল্যাট' },
    ongoingEvents: { en: 'Ongoing Events', bn: 'চলমান ইভেন্ট' },
    pendingRequests: { en: 'Pending Requests', bn: 'অপেক্ষমাণ অনুরোধ' },
    allTimeIncome: { en: 'All-time Income', bn: 'সর্বমোট আয়' },
    incomeVsExpenseTrend: { en: 'Income vs Expense — Last 6 Months', bn: 'আয় বনাম ব্যয় — গত ৬ মাস' },
    expenseBreakdown: { en: 'Expense Breakdown (This Month)', bn: 'ব্যয়ের বিশ্লেষণ (এই মাস)' },
    recentTransactions: { en: 'Recent Transactions', bn: 'সাম্প্রতিক লেনদেন' },
    noTransactionsYet: { en: 'No transactions yet.', bn: 'এখনো কোনো লেনদেন নেই।' },
    noFlatLinked: { en: 'No flat linked to your account yet — contact the building admin.', bn: 'আপনার অ্যাকাউন্টের সাথে কোনো ফ্ল্যাট যুক্ত নেই — ভবন অ্যাডমিনের সাথে যোগাযোগ করুন।' },
    totalDue: { en: 'Total Due', bn: 'মোট বকেয়া' },
    totalPaid: { en: 'Total Paid', bn: 'মোট পরিশোধিত' },
    balance: { en: 'Balance', bn: 'ব্যালেন্স' },
    outstandingBalance: { en: 'Outstanding Balance', bn: 'অবশিষ্ট ব্যালেন্স' },
    latestNotices: { en: 'Latest Notices', bn: 'সাম্প্রতিক নোটিশ' },
    noNoticesYet: { en: 'No notices posted yet.', bn: 'এখনো কোনো নোটিশ প্রকাশিত হয়নি।' },
    myRecentPayments: { en: 'My Recent Payments', bn: 'আমার সাম্প্রতিক পেমেন্ট' },
    fullHistory: { en: 'Full History', bn: 'সম্পূর্ণ ইতিহাস' },
    noPaymentHistory: { en: 'No payment history found.', bn: 'কোনো পেমেন্ট ইতিহাস পাওয়া যায়নি।' },
    myMaintenanceRequests: { en: 'My Maintenance Requests', bn: 'আমার রক্ষণাবেক্ষণ অনুরোধ' },
    newRequest: { en: 'New Request', bn: 'নতুন অনুরোধ' },
    noRequestsSubmitted: { en: "You haven't submitted any requests.", bn: 'আপনি এখনো কোনো অনুরোধ জমা দেননি।' },

    // ---- Notices ----
    buildingNotices: { en: 'Building Notices', bn: 'ভবনের নোটিশ' },
    postNotice: { en: 'Post Notice', bn: 'নোটিশ প্রকাশ করুন' },
    postNewNotice: { en: 'Post New Notice', bn: 'নতুন নোটিশ প্রকাশ করুন' },
    title: { en: 'Title', bn: 'শিরোনাম' },
    details: { en: 'Details', bn: 'বিস্তারিত' },
    pinToTop: { en: 'Pin this notice to top', bn: 'এই নোটিশটি উপরে পিন করুন' },
    pinned: { en: 'Pinned', bn: 'পিন করা' },
    postedBy: { en: 'Posted by', bn: 'প্রকাশ করেছেন' },
    noNoticesPosted: { en: 'No notices have been posted yet.', bn: 'এখনো কোনো নোটিশ প্রকাশিত হয়নি।' },
    deleteNoticeConfirm: { en: 'Delete this notice permanently?', bn: 'এই নোটিশটি স্থায়ীভাবে মুছে ফেলবেন?' },

    // ---- Maintenance requests ----
    allRequestsTitle: { en: 'All Maintenance & Feedback Requests', bn: 'সকল রক্ষণাবেক্ষণ ও মতামত অনুরোধ' },
    myRequestsTitle: { en: 'My Requests & Feedback', bn: 'আমার অনুরোধ ও মতামত' },
    submitRequest: { en: 'Submit Maintenance / Feedback Request', bn: 'রক্ষণাবেক্ষণ / মতামত অনুরোধ জমা দিন' },
    subject: { en: 'Subject', bn: 'বিষয়' },
    priority: { en: 'Priority', bn: 'অগ্রাধিকার' },
    submit: { en: 'Submit Request', bn: 'অনুরোধ জমা দিন' },
    response: { en: 'Response', bn: 'প্রতিক্রিয়া' },
    approve: { en: 'Approve', bn: 'অনুমোদন করুন' },
    reject: { en: 'Reject', bn: 'প্রত্যাখ্যান করুন' },
    noRequestsFound: { en: 'No requests found.', bn: 'কোনো অনুরোধ পাওয়া যায়নি।' },

    // ---- My Ledger ----
    myLedgerTitle: { en: 'My Ledger', bn: 'আমার হিসাব' },
    ledgerStatementSubtitle: { en: 'Full statement of dues and payments linked to your flat.', bn: 'আপনার ফ্ল্যাটের সাথে সম্পর্কিত বকেয়া ও পেমেন্টের সম্পূর্ণ বিবরণী।' },
    noFlatContactAdmin: { en: 'No flat is linked to your account yet. Please contact the building administrator.', bn: 'আপনার অ্যাকাউন্টের সাথে কোনো ফ্ল্যাট যুক্ত নেই। অনুগ্রহ করে ভবন প্রশাসকের সাথে যোগাযোগ করুন।' },
    monthlyDuesSchedule: { en: 'Monthly Dues Schedule', bn: 'মাসিক বকেয়া সময়সূচি' },
    period: { en: 'Period', bn: 'সময়কাল' },
    due: { en: 'Due', bn: 'বকেয়া' },
    noDuesGenerated: { en: 'No dues generated yet.', bn: 'এখনো কোনো বকেয়া তৈরি হয়নি।' },
    paymentHistory: { en: 'Payment History', bn: 'পেমেন্টের ইতিহাস' },
    noPaymentsRecorded: { en: 'No payments recorded.', bn: 'কোনো পেমেন্ট রেকর্ড করা হয়নি।' },

    // ---- Profile ----
    memberSince: { en: 'Member Since', bn: 'সদস্য হয়েছেন' },
    changePassword: { en: 'Change Password', bn: 'পাসওয়ার্ড পরিবর্তন করুন' },
    currentPassword: { en: 'Current Password', bn: 'বর্তমান পাসওয়ার্ড' },
    newPassword: { en: 'New Password', bn: 'নতুন পাসওয়ার্ড' },
    confirmNewPassword: { en: 'Confirm New Password', bn: 'নতুন পাসওয়ার্ড নিশ্চিত করুন' },
    updatePassword: { en: 'Update Password', bn: 'পাসওয়ার্ড আপডেট করুন' },

    // ---- Transactions ----
    addIncome: { en: 'Income', bn: 'আয়' },
    addExpense: { en: 'Expense', bn: 'ব্যয়' },
    recordNewIncome: { en: 'Record New Income', bn: 'নতুন আয় রেকর্ড করুন' },
    recordNewExpense: { en: 'Record New Expense', bn: 'নতুন ব্যয় রেকর্ড করুন' },
    receivedFrom: { en: 'Received From', bn: 'যার কাছ থেকে গৃহীত' },
    paidTo: { en: 'Paid To', bn: 'যাকে প্রদান করা হয়েছে' },
    relatedFlatOptional: { en: 'Related Flat (optional)', bn: 'সম্পর্কিত ফ্ল্যাট (ঐচ্ছিক)' },
    relatedEventOptional: { en: 'Related Event (optional)', bn: 'সম্পর্কিত ইভেন্ট (ঐচ্ছিক)' },
    notes: { en: 'Notes', bn: 'নোট' },
    saveIncome: { en: 'Save Income', bn: 'আয় সংরক্ষণ করুন' },
    saveExpense: { en: 'Save Expense', bn: 'ব্যয় সংরক্ষণ করুন' },
    flatOrEvent: { en: 'Flat/Event', bn: 'ফ্ল্যাট/ইভেন্ট' },
    noTxnMatch: { en: 'No transactions match your filters.', bn: 'আপনার ফিল্টারের সাথে কোনো লেনদেন মেলেনি।' },
    deleteTxnConfirm: { en: 'Delete this transaction? This cannot be undone.', bn: 'এই লেনদেনটি মুছে ফেলবেন? এটি পূর্বাবস্থায় ফেরানো যাবে না।' },
    printThermalReceipt: { en: 'Print Thermal Receipt', bn: 'থার্মাল রশিদ প্রিন্ট করুন' },
    choosePaperSize: { en: 'Choose your POS printer paper size:', bn: 'আপনার পিওএস প্রিন্টারের কাগজের আকার নির্বাচন করুন:' },

    // ---- Collections ----
    flatCollectionsDues: { en: 'Flat Collections & Dues', bn: 'ফ্ল্যাট কালেকশন ও বকেয়া' },
    generateDues: { en: 'Generate Dues', bn: 'বকেয়া তৈরি করুন' },
    owner: { en: 'Owner', bn: 'মালিক' },
    action: { en: 'Action', bn: 'পদক্ষেপ' },
    collect: { en: 'Collect', bn: 'সংগ্রহ করুন' },
    noDuesForPeriod: { en: 'No dues generated for this period yet. Click "Generate Dues" above.', bn: 'এই সময়ের জন্য এখনো কোনো বকেয়া তৈরি হয়নি। উপরে "বকেয়া তৈরি করুন" ক্লিক করুন।' },
    collectPayment: { en: 'Collect Payment', bn: 'পেমেন্ট সংগ্রহ করুন' },
    outstandingBalanceLabel: { en: 'Outstanding Balance', bn: 'অবশিষ্ট ব্যালেন্স' },
    amountReceived: { en: 'Amount Received', bn: 'গৃহীত পরিমাণ' },
    confirmCollection: { en: 'Confirm Collection', bn: 'সংগ্রহ নিশ্চিত করুন' },

    // ---- Events ----
    eventsFundManagement: { en: 'Events & Fund Management', bn: 'ইভেন্ট ও তহবিল ব্যবস্থাপনা' },
    newEvent: { en: 'New Event', bn: 'নতুন ইভেন্ট' },
    createNewEvent: { en: 'Create New Event', bn: 'নতুন ইভেন্ট তৈরি করুন' },
    eventName: { en: 'Event Name', bn: 'ইভেন্টের নাম' },
    budget: { en: 'Budget', bn: 'বাজেট' },
    startDate: { en: 'Start Date', bn: 'শুরুর তারিখ' },
    endDate: { en: 'End Date', bn: 'শেষের তারিখ' },
    createEvent: { en: 'Create Event', bn: 'ইভেন্ট তৈরি করুন' },
    collected: { en: 'Collected', bn: 'সংগৃহীত' },
    spent: { en: 'Spent', bn: 'ব্যয়িত' },
    surplus: { en: 'Surplus', bn: 'উদ্বৃত্ত' },
    deficit: { en: 'Deficit', bn: 'ঘাটতি' },
    noEventsYet: { en: 'No events created yet.', bn: 'এখনো কোনো ইভেন্ট তৈরি হয়নি।' },

    // ---- Ledger ----
    ownerShareholderLedger: { en: 'Owner / Shareholder Ledger', bn: 'মালিক / শেয়ারহোল্ডার হিসাব' },
    addFlat: { en: 'Add Flat', bn: 'ফ্ল্যাট যোগ করুন' },
    selectAFlat: { en: 'Select a Flat', bn: 'একটি ফ্ল্যাট নির্বাচন করুন' },
    selectFlatPrompt: { en: 'Select a flat from the list to view its ledger statement.', bn: 'তালিকা থেকে একটি ফ্ল্যাট নির্বাচন করুন তার হিসাব বিবরণী দেখতে।' },
    noFlatsRegistered: { en: 'No flats registered.', bn: 'কোনো ফ্ল্যাট নিবন্ধিত নেই।' },
    addNewFlat: { en: 'Add New Flat / Unit', bn: 'নতুন ফ্ল্যাট / ইউনিট যোগ করুন' },
    flatUnitNo: { en: 'Flat / Unit No.', bn: 'ফ্ল্যাট / ইউনিট নং' },
    ownerName: { en: 'Owner Name', bn: 'মালিকের নাম' },
    tenantName: { en: 'Tenant Name (if rented)', bn: 'ভাড়াটিয়ার নাম (যদি ভাড়া দেওয়া হয়)' },
    monthlyFee: { en: 'Monthly Fee', bn: 'মাসিক ফি' },
    printStatement: { en: 'Print Statement', bn: 'বিবরণী প্রিন্ট করুন' },
    paymentTransactions: { en: 'Payment Transactions', bn: 'পেমেন্ট লেনদেন' },

    // ---- Reports ----
    accountingReports: { en: 'Accounting Reports', bn: 'হিসাব প্রতিবেদন' },
    cashbookDaybook: { en: 'Cashbook / Daybook', bn: 'নগদ বই / দৈনিক বই' },
    incomeVsExpense: { en: 'Income vs Expense', bn: 'আয় বনাম ব্যয়' },
    assetsLiabilities: { en: 'Assets & Liabilities', bn: 'সম্পদ ও দায়' },
    eventSummary: { en: 'Event Summary', bn: 'ইভেন্ট সারসংক্ষেপ' },
    runReport: { en: 'Run Report', bn: 'রিপোর্ট চালান' },
    totalReceipts: { en: 'Total Receipts', bn: 'মোট প্রাপ্তি' },
    totalPayments: { en: 'Total Payments', bn: 'মোট প্রদান' },
    closingBalance: { en: 'Closing Balance', bn: 'সমাপনী ব্যালেন্স' },
    particulars: { en: 'Particulars', bn: 'বিবরণ' },
    receiptIn: { en: 'Receipt (In)', bn: 'প্রাপ্তি (ইন)' },
    paymentOut: { en: 'Payment (Out)', bn: 'প্রদান (আউট)' },
    noTxnInRange: { en: 'No transactions in this range.', bn: 'এই পরিসরে কোনো লেনদেন নেই।' },
    totalIncome: { en: 'Total Income', bn: 'মোট আয়' },
    totalExpense: { en: 'Total Expense', bn: 'মোট ব্যয়' },
    netProfit: { en: 'NET PROFIT', bn: 'নিট মুনাফা' },
    netLoss: { en: 'NET LOSS', bn: 'নিট ক্ষতি' },
    incomeByCategory: { en: 'Income by Category', bn: 'ক্যাটাগরি অনুযায়ী আয়' },
    expenseByCategory: { en: 'Expense by Category', bn: 'ক্যাটাগরি অনুযায়ী ব্যয়' },
    noIncomeRecorded: { en: 'No income recorded.', bn: 'কোনো আয় রেকর্ড করা হয়নি।' },
    noExpenseRecorded: { en: 'No expense recorded.', bn: 'কোনো ব্যয় রেকর্ড করা হয়নি।' },
    assets: { en: 'Assets', bn: 'সম্পদ' },
    liabilitiesEquity: { en: 'Liabilities & Equity', bn: 'দায় ও ইক্যুইটি' },
    cashBankBalance: { en: 'Cash / Bank Balance (Net Collections)', bn: 'নগদ / ব্যাংক ব্যালেন্স (নিট কালেকশন)' },
    outstandingDuesReceivable: { en: 'Outstanding Dues Receivable', bn: 'বকেয়া প্রাপ্য' },
    buildingAssetsAtCost: { en: 'Building Assets (at cost)', bn: 'ভবনের সম্পদ (ক্রয়মূল্যে)' },
    totalAssets: { en: 'Total Assets', bn: 'মোট সম্পদ' },
    knownLiabilities: { en: 'Known Liabilities', bn: 'পরিচিত দায়' },
    buildingFundEquity: { en: 'Building Fund / Equity', bn: 'ভবন তহবিল / ইক্যুইটি' },
    balanceOverviewNote: { en: 'This is a simplified overview derived from recorded transactions, outstanding dues and logged assets. For formal statutory accounting, reconcile with your registered accountant.', bn: 'এটি রেকর্ডকৃত লেনদেন, বকেয়া এবং সম্পদের তালিকা থেকে তৈরি একটি সরলীকৃত সারসংক্ষেপ। আনুষ্ঠানিক হিসাবের জন্য আপনার নিবন্ধিত হিসাবরক্ষকের সাথে মিলিয়ে নিন।' },
    noEventsFound: { en: 'No events found.', bn: 'কোনো ইভেন্ট পাওয়া যায়নি।' },

    // ---- Categories ----
    incomeExpenseCategories: { en: 'Income & Expense Categories', bn: 'আয় ও ব্যয়ের ক্যাটাগরি' },
    incomeCategories: { en: 'Income Categories', bn: 'আয়ের ক্যাটাগরি' },
    expenseCategories: { en: 'Expense Categories', bn: 'ব্যয়ের ক্যাটাগরি' },
    noIncomeCategories: { en: 'No income categories.', bn: 'কোনো আয়ের ক্যাটাগরি নেই।' },
    noExpenseCategories: { en: 'No expense categories.', bn: 'কোনো ব্যয়ের ক্যাটাগরি নেই।' },
    categoryName: { en: 'Category Name', bn: 'ক্যাটাগরির নাম' },
    addCategory: { en: 'Add Category', bn: 'ক্যাটাগরি যোগ করুন' },
    deleteCategoryConfirm: { en: "Delete this category? Existing transactions will keep their category name as text.", bn: 'এই ক্যাটাগরিটি মুছে ফেলবেন? বিদ্যমান লেনদেনগুলো তাদের ক্যাটাগরির নাম টেক্সট হিসেবে রাখবে।' },

    // ---- Users ----
    addUser: { en: 'Add User', bn: 'ব্যবহারকারী যোগ করুন' },
    addNewUser: { en: 'Add New User', bn: 'নতুন ব্যবহারকারী যোগ করুন' },
    fullName: { en: 'Full Name', bn: 'পূর্ণ নাম' },
    tempPassword: { en: 'Temp. Password', bn: 'অস্থায়ী পাসওয়ার্ড' },
    linkToFlat: { en: 'Link to Flat (for Residents)', bn: 'ফ্ল্যাটের সাথে যুক্ত করুন (বাসিন্দাদের জন্য)' },
    createUser: { en: 'Create User', bn: 'ব্যবহারকারী তৈরি করুন' },
    editUser: { en: 'Edit User', bn: 'ব্যবহারকারী সম্পাদনা করুন' },
    saveChanges: { en: 'Save Changes', bn: 'পরিবর্তন সংরক্ষণ করুন' },
    resetPassword: { en: 'Reset Password', bn: 'পাসওয়ার্ড রিসেট করুন' },
    resetPw: { en: 'Reset PW', bn: 'পিডব্লিউ রিসেট' },
    newPasswordLabel: { en: 'New Password', bn: 'নতুন পাসওয়ার্ড' },
    enable: { en: 'Enable', bn: 'সক্রিয় করুন' },
    disable: { en: 'Disable', bn: 'নিষ্ক্রিয় করুন' },
    noUsersFound: { en: 'No users found.', bn: 'কোনো ব্যবহারকারী পাওয়া যায়নি।' },
    usernameExists: { en: 'Username already exists.', bn: 'ইউজারনেম ইতিমধ্যে বিদ্যমান।' },

    // ---- Settings ----
    buildingProfile: { en: 'Building Profile', bn: 'ভবনের প্রোফাইল' },
    syncApi: { en: 'Sync / API', bn: 'সিঙ্ক / এপিআই' },
    backupRestore: { en: 'Backup & Restore', bn: 'ব্যাকআপ ও পুনরুদ্ধার' },
    dataManagement: { en: 'Data Management', bn: 'ডেটা ব্যবস্থাপনা' },
    buildingLogo: { en: 'Building Logo', bn: 'ভবনের লোগো' },
    buildingProjectName: { en: 'Building / Project Name', bn: 'ভবন / প্রকল্পের নাম' },
    address: { en: 'Address', bn: 'ঠিকানা' },
    contactPhone: { en: 'Contact Phone', bn: 'যোগাযোগের ফোন' },
    currencyCode: { en: 'Currency Code', bn: 'মুদ্রার কোড' },
    currencySymbol: { en: 'Currency Symbol', bn: 'মুদ্রার প্রতীক' },
    saveBuildingProfile: { en: 'Save Building Profile', bn: 'ভবনের প্রোফাইল সংরক্ষণ করুন' },
    syncApiDesc: { en: 'Optional: connect a sync backend — either your own Node server (server/ folder) or a Google Apps Script web app that stores data in your Google Drive (google-drive-sync/ folder). Paste its URL below and use the same API key you set there. The app works fully offline without this — leave blank to stay local-only on this device.', bn: 'ঐচ্ছিক: একটি সিঙ্ক ব্যাকএন্ড যুক্ত করুন — হয় আপনার নিজের Node সার্ভার (server/ ফোল্ডার), অথবা Google Apps Script ওয়েব অ্যাপ যা আপনার Google Drive-এ ডেটা রাখে (google-drive-sync/ ফোল্ডার)। নিচে তার URL দিন এবং সেখানে সেট করা একই API Key ব্যবহার করুন। এটি ছাড়াই অ্যাপটি সম্পূর্ণ অফলাইনে কাজ করে — শুধুমাত্র এই ডিভাইসে ডেটা রাখতে খালি রাখুন।' },
    apiEndpointUrl: { en: 'API Endpoint URL', bn: 'এপিআই এন্ডপয়েন্ট ইউআরএল' },
    apiKeyOptional: { en: 'API Key (optional)', bn: 'এপিআই কী (ঐচ্ছিক)' },
    saveSyncSettings: { en: 'Save Sync Settings', bn: 'সিঙ্ক সেটিংস সংরক্ষণ করুন' },
    exportBackup: { en: 'Export Backup', bn: 'ব্যাকআপ এক্সপোর্ট করুন' },
    exportBackupDesc: { en: 'Download a complete JSON backup of all data on this device — users, transactions, flats, events, assets and more.', bn: 'এই ডিভাইসের সকল ডেটার একটি সম্পূর্ণ জেএসওএন ব্যাকআপ ডাউনলোড করুন — ব্যবহারকারী, লেনদেন, ফ্ল্যাট, ইভেন্ট, সম্পদ এবং আরও অনেক কিছু।' },
    downloadBackupJson: { en: 'Download Backup (JSON)', bn: 'ব্যাকআপ ডাউনলোড করুন (জেএসওএন)' },
    lastBackup: { en: 'Last backup', bn: 'সর্বশেষ ব্যাকআপ' },
    restoreFromBackup: { en: 'Restore from Backup', bn: 'ব্যাকআপ থেকে পুনরুদ্ধার করুন' },
    restoreDesc: { en: 'Restoring will replace all current data with the contents of the backup file. This cannot be undone.', bn: 'পুনরুদ্ধার করলে বর্তমান সকল ডেটা ব্যাকআপ ফাইলের বিষয়বস্তু দ্বারা প্রতিস্থাপিত হবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।' },
    restoreFromFile: { en: 'Restore from File', bn: 'ফাইল থেকে পুনরুদ্ধার করুন' },
    dangerZone: { en: 'Danger Zone', bn: 'বিপদজনক অঞ্চল' },
    dangerZoneDesc: { en: 'Permanently erase all transactions, users (except Super Admin), flats, events, assets, and logs from this device. This action cannot be undone — export a backup first.', bn: 'এই ডিভাইস থেকে সকল লেনদেন, ব্যবহারকারী (সুপার অ্যাডমিন ছাড়া), ফ্ল্যাট, ইভেন্ট, সম্পদ ও লগ স্থায়ীভাবে মুছে ফেলুন। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না — প্রথমে একটি ব্যাকআপ এক্সপোর্ট করুন।' },
    fullDataReset: { en: 'Full Data Reset', bn: 'সম্পূর্ণ ডেটা রিসেট' },

    // ---- Audit ----
    systemAuditLog: { en: 'System Audit Log', bn: 'সিস্টেম অডিট লগ' },
    searchActions: { en: 'Search actions...', bn: 'কার্যক্রম খুঁজুন...' },
    timestamp: { en: 'Timestamp', bn: 'সময়' },
    user: { en: 'User', bn: 'ব্যবহারকারী' },
    noAuditRecords: { en: 'No audit records yet.', bn: 'এখনো কোনো অডিট রেকর্ড নেই।' },
    noMatchingRecords: { en: 'No matching records.', bn: 'কোনো মিলে যাওয়া রেকর্ড নেই।' },

    // ---- Inventory / Assets (new module) ----
    propertyAssets: { en: 'Property & Asset Management', bn: 'সম্পত্তি ও সম্পদ ব্যবস্থাপনা' },
    flatsInventory: { en: 'Flats Inventory', bn: 'ফ্ল্যাট তালিকা' },
    assetTracker: { en: 'Asset Tracker', bn: 'সম্পদ ট্র্যাকার' },
    floor: { en: 'Floor', bn: 'তলা' },
    sizeSqft: { en: 'Size (sqft)', bn: 'আয়তন (বর্গফুট)' },
    contactInfo: { en: 'Contact Info', bn: 'যোগাযোগের তথ্য' },
    addNewAsset: { en: 'Add New Asset', bn: 'নতুন সম্পদ যোগ করুন' },
    editAsset: { en: 'Edit Asset', bn: 'সম্পদ সম্পাদনা করুন' },
    assetName: { en: 'Asset Name', bn: 'সম্পদের নাম' },
    assetCategory: { en: 'Asset Category', bn: 'সম্পদের ক্যাটাগরি' },
    serialModelNo: { en: 'Serial / Model No.', bn: 'সিরিয়াল / মডেল নং' },
    purchaseDate: { en: 'Date of Purchase', bn: 'ক্রয়ের তারিখ' },
    warrantyExpiry: { en: 'Warranty Expiry Date', bn: 'ওয়ারেন্টি মেয়াদ শেষ' },
    condition: { en: 'Condition', bn: 'অবস্থা' },
    purchaseCost: { en: 'Purchase Cost', bn: 'ক্রয় মূল্য' },
    location: { en: 'Current Location', bn: 'বর্তমান অবস্থান' },
    saveAsset: { en: 'Save Asset', bn: 'সম্পদ সংরক্ষণ করুন' },
    noAssetsYet: { en: 'No assets have been logged yet.', bn: 'এখনো কোনো সম্পদ লগ করা হয়নি।' },
    deleteAssetConfirm: { en: 'Delete this asset and all its maintenance history?', bn: 'এই সম্পদ এবং এর সকল রক্ষণাবেক্ষণ ইতিহাস মুছে ফেলবেন?' },
    maintenanceHistory: { en: 'Maintenance / Service History', bn: 'রক্ষণাবেক্ষণ / সার্ভিস ইতিহাস' },
    logService: { en: 'Log Service', bn: 'সার্ভিস লগ করুন' },
    logMaintenanceService: { en: 'Log Maintenance / Service', bn: 'রক্ষণাবেক্ষণ / সার্ভিস লগ করুন' },
    serviceDate: { en: 'Service Date', bn: 'সার্ভিসের তারিখ' },
    repairCost: { en: 'Repair / Service Cost', bn: 'মেরামত / সার্ভিস খরচ' },
    technicianName: { en: 'Technician Name', bn: 'টেকনিশিয়ানের নাম' },
    technicianContact: { en: 'Technician Contact', bn: 'টেকনিশিয়ানের যোগাযোগ' },
    nextServiceDate: { en: 'Next Service Due (optional)', bn: 'পরবর্তী সার্ভিসের তারিখ (ঐচ্ছিক)' },
    saveServiceLog: { en: 'Save Service Log', bn: 'সার্ভিস লগ সংরক্ষণ করুন' },
    noServiceLogs: { en: 'No maintenance/service logs recorded for this asset.', bn: 'এই সম্পদের জন্য কোনো রক্ষণাবেক্ষণ/সার্ভিস লগ রেকর্ড করা হয়নি।' },
    recordAsset: { en: 'Record New Asset', bn: 'নতুন সম্পদ রেকর্ড করুন' },
    warrantyExpired: { en: 'Warranty Expired', bn: 'ওয়ারেন্টি শেষ' },
    underWarranty: { en: 'Under Warranty', bn: 'ওয়ারেন্টির আওতায়' },
    totalAssetValue: { en: 'Total Asset Value', bn: 'মোট সম্পদ মূল্য' },
    assetsNeedingAttention: { en: 'Needing Attention', bn: 'মনোযোগ প্রয়োজন' },
    back: { en: 'Back', bn: 'ফিরে যান' },

    // ---- Toasts / misc ----
    permissionDenied: { en: 'You do not have permission to view that page.', bn: 'এই পৃষ্ঠাটি দেখার অনুমতি আপনার নেই।' },
    somethingWrong: { en: 'Something went wrong loading this page. Please try again.', bn: 'এই পৃষ্ঠাটি লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' },
    syncStarted: { en: 'Sync started…', bn: 'সিঙ্ক শুরু হয়েছে…' },
    online: { en: 'Online', bn: 'অনলাইন' },
    offline: { en: 'Offline', bn: 'অফলাইন' },
    liveSync: { en: 'Live', bn: 'লাইভ' },

    // ---- Print / Voucher labels ----
    voucherNoLabel: { en: 'Voucher No', bn: 'ভাউচার নং' },
    typeLabel: { en: 'Type', bn: 'ধরন' },
    receiptIncomeLabel: { en: 'RECEIPT (Income)', bn: 'রশিদ (আয়)' },
    paymentExpenseLabel: { en: 'PAYMENT (Expense)', bn: 'পেমেন্ট (ব্যয়)' },
    totalLabel: { en: 'TOTAL', bn: 'সর্বমোট' },
    enteredByLabel: { en: 'Entered by', bn: 'যিনি এন্ট্রি করেছেন' },
    printedLabel: { en: 'Printed', bn: 'প্রিন্টের সময়' },
    thankYouFooter: { en: 'Thank you! This is a system generated receipt.', bn: 'ধন্যবাদ! এটি একটি সিস্টেম-জেনারেটেড রশিদ।' },
    receiptVoucherLabel: { en: 'RECEIPT VOUCHER', bn: 'রশিদ ভাউচার' },
    paymentVoucherLabel: { en: 'PAYMENT VOUCHER', bn: 'পেমেন্ট ভাউচার' },
    noLabelShort: { en: 'No', bn: 'নং' },
    flatUnitNoLabel: { en: 'Flat / Unit No.', bn: 'ফ্ল্যাট / ইউনিট নং' },
    paymentMethodLabel: { en: 'Payment Method', bn: 'পেমেন্ট পদ্ধতি' },
    preparedByLabel: { en: 'Prepared By', bn: 'প্রস্তুতকারী' },
    approvedByLabel: { en: 'Approved By', bn: 'অনুমোদনকারী' },
    receiverSignatureLabel: { en: "Receiver's Signature", bn: 'গ্রহীতার স্বাক্ষর' },
    voucherFooterNote: { en: 'System generated voucher — printed on', bn: 'সিস্টেম-জেনারেটেড ভাউচার — প্রিন্টের তারিখ' },
    generatedOnLabel: { en: 'Generated on', bn: 'তৈরির তারিখ' },

    // ---- Misc validation messages ----
    passwordsMismatch: { en: 'Passwords do not match.', bn: 'পাসওয়ার্ড দুটি মিলছে না।' },
    incorrectCurrentPassword: { en: 'Incorrect current password.', bn: 'বর্তমান পাসওয়ার্ড ভুল।' },
    invalidAmount: { en: 'Invalid amount.', bn: 'পরিমাণ সঠিক নয়।' },
    chooseFileFirst: { en: 'Choose a file first.', bn: 'প্রথমে একটি ফাইল নির্বাচন করুন।' },
    invalidBackupFile: { en: 'Invalid backup file', bn: 'ব্যাকআপ ফাইলটি সঠিক নয়' }
  },

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    this.lang = (saved === 'bn' || saved === 'en') ? saved : 'en';
    document.documentElement.lang = this.lang;
    this.applyStatic();
    this.updateToggleLabel();
  },

  t(key) {
    const entry = this.DICT[key];
    if (!entry) return key;
    return entry[this.lang] || entry.en || key;
  },

  setLang(lang) {
    if (lang !== 'en' && lang !== 'bn') return;
    this.lang = lang;
    localStorage.setItem(this.STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    this.applyStatic();
    this.updateToggleLabel();
    // Re-render whatever is currently on screen so dynamic template strings
    // (nav, tables, forms) pick up the new language too.
    if (window.App && window.Auth && Auth.isLoggedIn()) {
      App.buildNav();
      App.navigateTo(App.currentView);
    }
  },

  toggle() {
    this.setLang(this.lang === 'en' ? 'bn' : 'en');
  },

  updateToggleLabel() {
    const btn = document.getElementById('lang-toggle-btn');
    if (btn) {
      btn.innerHTML = this.lang === 'en'
        ? '🇧🇩 <span class="hidden sm:inline">বাংলা</span>'
        : '🇬🇧 <span class="hidden sm:inline">English</span>';
    }
  },

  // Apply translations to every static element in the DOM tagged with
  // data-i18n (textContent) or data-i18n-placeholder (input placeholder).
  applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-placeholder')));
    });
  }
};

// Shorthand global used throughout every view file.
function t(key) { return I18N.t(key); }
