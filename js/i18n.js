// js/i18n.js - Bilingual internationalization (AZ / EN) for TripSplit
window.TripSplit = window.TripSplit || {};

(function() {
  const translations = {
    az: {
      app_title: "TripSplit",
      app_tagline: "Qrup Səyahətləri üçün Xərc Bölüşdürücü",
      trips_title: "Səyahətlərim",
      new_trip: "Yeni Səyahət",
      no_trips: "Hələ heç bir səyahət yaradılmayıb. Yeni səyahət yaradaraq başlayın!",
      trip_name: "Səyahətin Adı",
      trip_name_placeholder: "məs. Bakı Həftəsonu, Quba İstirahəti",
      base_currency: "Əsas Valyuta",
      create: "Yarat",
      save: "Yadda Saxla",
      cancel: "Ləğv et",
      close: "Bağla",
      edit: "Düzəliş et",
      edit_participant: "İştirakçının Adını Dəyiş",
      rename: "Adı Dəyiş",
      delete: "Sil",
      open: "Aç",
      back_to_trips: "← Səyahətlər",
      reset_all_data: "Bütün Məlumatları Sıfırla",
      export_data: "İxrac et (JSON)",
      import_data: "İdxal et (JSON)",
      import_success: "Məlumatlar uğurla idxal olundu!",
      import_invalid: "Xəta: Yanlış JSON fayl strukturu!",
      participants: "İştirakçılar",
      add_participant: "İştirakçı əlavə et",
      participant_name_placeholder: "İştirakçı adı",
      participant_in_use: "Bu iştirakçı xərclərdə qeyd olunub, onu silmək olmaz!",
      min_participants_warning: "Səyahətdə ən azı 2 iştirakçı olmalıdır!",
      name_already_exists: "Bu adda iştirakçı artıq mövcuddur!",
      name_empty: "İştirakçı adı boş ola bilməz!",
      total_trip_cost: "Ümumi Səyahət Xərci",
      expenses: "Xərclər",
      add_expense: "+ Yeni Xərc",
      edit_expense: "Xərcə Düzəliş Et",
      no_expenses: "Hələ xərc əlavə edilməyib. '+ Yeni Xərc' düyməsi ilə ilk xərcinizi qeyd edin.",
      expense_title: "Xərcin Təsviri / Adı",
      expense_title_placeholder: "məs. Restoranda şam yeməyi, Yanacaq",
      category: "Kateqoriya",
      amount: "Məbləğ",
      currency: "Valyuta",
      paid_by: "Kim Ödədi?",
      date: "Tarix",
      split_method: "Bölüşdürmə Növü",
      split_equal: "Bərabər Bölüşdür",
      split_custom: "Fərdi Məbləğlərlə",
      split_among: "Kimlər Arasında Bölünsün?",
      select_all: "Hamısını seç",
      deselect_all: "Hamısını sil",
      exchange_rate: "Məzənnə",
      rate_snapshot: "Qeydə alınmış məzənnə",
      override_rate: "Məzənnəni fərdi təyin et",
      rate_override_placeholder: "məs. 1.70",
      custom_amounts_title: "Fərdi Hissələr",
      remaining_diff: "Qalan Fərq",
      matched_exact: "Tam bərabərdir",
      balances: "Balanslar",
      gets_back: "alacaq",
      owes: "borcludur",
      all_settled: "Bütün hesablar bərabərdir! Heç kimin borcu yoxdur.",
      who_owes_whom: "Kimin Kimə Nə Qədər Borcu Var",
      mark_as_paid: "Ödənildi Kimi Qeyd Et",
      settlement_history: "Ödəniş Tarixçəsi",
      no_settlements: "Hələ heç bir ödəniş qeydə alınmayıb.",
      undo: "Geri Qaytar",
      copy_summary: "Xülasəni Kopyala",
      summary_copied: "Xülasə buferə kopyalandı! (WhatsApp/Telegram-a yapışdıra bilərsiniz)",
      summary_copy_failed: "Kopyalamaq alınmadı, zəhmət olmasa mətni əllə seçin.",
      category_breakdown: "Kateqoriyalar üzrə Xərclər",
      currency_converter: "Valyuta Konverteri",
      convert: "Çevir",
      from: "Haradan",
      to: "Haraya",
      swap: "Dəyiş",
      refresh_rates: "Məzənnələri Yenilə",
      rates_live: "🟢 Canlı məzənnələr ({time} yeniləndi)",
      rates_cached: "🟡 Keşlənmiş məzənnələr ({date})",
      rates_fallback: "🔴 Oflayn ehtiyat məzənnələr ({date})",
      rates_outdated_warning: "Diqqət: Məzənnələr 24 saatdan köhnədir.",
      status_online: "Onlayn",
      status_offline: "Oflayn",
      storage_warning: "Diqqət: Brauzer yaddaşı (localStorage) işləmir. Məlumatlar yalnız cari baxış üçün yaddaşda qalacaq.",
      confirm_delete_trip: "Bu səyahəti ('{name}') və bütün xərclərini silmək istədiyinizə əminsinizmi? Bu əməliyyat geri qaytarılmır.",
      confirm_reset_all: "Bütün səyahətlər və məlumatlar birdəfəlik silinəcək. Davam etmək istəyirsinizmi?",
      confirm_delete_expense: "Bu xərci ('{title}') silmək istədiyinizə əminsinizmi?",
      err_title_req: "Zəhmət olmasa xərcin adını daxil edin.",
      err_amount_positive: "Məbləğ 0-dan böyük olmalıdır.",
      err_general_save: "Xərc yadda saxlanarkən xəta baş verdi.",
      err_at_least_one_split: "Ən azı 1 nəfər bölüşdürmədə seçilməlidir.",
      err_custom_sum_mismatch: "Fərdi məbləğlərin cəmi ({sum}) ümumi məbləğə ({total}) bərabər olmalıdır! Fərq: {diff}",
      err_custom_excess: "Daxil edilən məbləğlərin cəmi ({sum}) ümumi xərcdən ({total}) çoxdur! Artıq: {diff}",
      err_negative_share: "Fərdi məbləğlər mənfi ola bilməz.",
      split_hybrid_summary: "Qalıq {rem} → {count} nəfər arasında bərabər bölünür",
      split_hybrid_zero_rem: "Qalıq 0.00 → digər {count} nəfər 0.00 alır",
      err_invalid_rate: "Düzgün məzənnə daxil edin.",
      cat_food: "Qida & Restoran 🍔",
      cat_transport: "Nəqliyyat & Yanacaq 🚕",
      cat_accommodation: "Qonaqlama & Otel 🏨",
      cat_entertainment: "Əyləncə & Biletlər 🎟️",
      cat_other: "Digər Xərclər 📦",
      default_friend_prefix: "Dost",
      whatsapp_title: "📊 {tripName} - Xərclərin Xülasəsi",
      whatsapp_total: "💰 Ümumi Xərc: {total}",
      whatsapp_balances_title: "👥 Fərdi Balanslar:",
      whatsapp_transfers_title: "💸 Borcların Tənzimlənməsi (Kimin kimə borcu var):",
      whatsapp_no_transfers: "✅ Bütün borclar tam ödənilib!",
      whatsapp_footer: "⚡ TripSplit ilə hesablandı"
    },
    en: {
      app_title: "TripSplit",
      app_tagline: "Group Trip Expense Splitting Made Effortless",
      trips_title: "My Trips",
      new_trip: "New Trip",
      no_trips: "No trips created yet. Click 'New Trip' to get started!",
      trip_name: "Trip Name",
      trip_name_placeholder: "e.g. Baku Weekend, Summer Roadtrip",
      base_currency: "Base Currency",
      create: "Create",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      edit: "Edit",
      edit_participant: "Edit Participant Name",
      rename: "Rename",
      delete: "Delete",
      open: "Open",
      back_to_trips: "← Trips",
      reset_all_data: "Reset All Data",
      export_data: "Export Data (JSON)",
      import_data: "Import Data (JSON)",
      import_success: "Data imported successfully!",
      import_invalid: "Error: Invalid JSON backup file structure!",
      participants: "Participants",
      add_participant: "Add Participant",
      participant_name_placeholder: "Participant name",
      participant_in_use: "This participant is involved in expenses and cannot be removed!",
      min_participants_warning: "A trip must have at least 2 participants!",
      name_already_exists: "A participant with this name already exists!",
      name_empty: "Participant name cannot be empty!",
      total_trip_cost: "Total Trip Cost",
      expenses: "Expenses",
      add_expense: "+ Add Expense",
      edit_expense: "Edit Expense",
      no_expenses: "No expenses recorded yet. Click '+ Add Expense' to log your first spend.",
      expense_title: "Expense Title / Description",
      expense_title_placeholder: "e.g. Group Dinner, Highway Fuel",
      category: "Category",
      amount: "Amount",
      currency: "Currency",
      paid_by: "Paid By",
      date: "Date",
      split_method: "Split Method",
      split_equal: "Split Equally",
      split_custom: "Custom Amounts",
      split_among: "Split Among Whom?",
      select_all: "Select all",
      deselect_all: "Deselect all",
      exchange_rate: "Exchange Rate",
      rate_snapshot: "Snapshot Exchange Rate",
      override_rate: "Override exchange rate manually",
      rate_override_placeholder: "e.g. 1.70",
      custom_amounts_title: "Custom Shares",
      remaining_diff: "Remaining Difference",
      matched_exact: "Matches exactly",
      balances: "Balances",
      gets_back: "gets back",
      owes: "owes",
      all_settled: "All balances are settled! Nobody owes anyone.",
      who_owes_whom: "Who Owes Whom",
      mark_as_paid: "Mark as Paid",
      settlement_history: "Settlement History",
      no_settlements: "No settlements recorded yet.",
      undo: "Undo",
      copy_summary: "Copy Summary",
      summary_copied: "Summary copied to clipboard! (Ready to paste in WhatsApp/Telegram)",
      summary_copy_failed: "Failed to copy automatically, please select and copy manually.",
      category_breakdown: "Expenses by Category",
      currency_converter: "Currency Converter",
      convert: "Convert",
      from: "From",
      to: "To",
      swap: "Swap",
      refresh_rates: "Refresh Rates",
      rates_live: "🟢 Live rates (updated {time})",
      rates_cached: "🟡 Cached rates ({date})",
      rates_fallback: "🔴 Offline fallback rates ({date})",
      rates_outdated_warning: "Warning: Exchange rates are older than 24 hours.",
      status_online: "Online",
      status_offline: "Offline",
      storage_warning: "Notice: Local storage is disabled or unavailable. Data will only persist in memory for this session.",
      confirm_delete_trip: "Are you sure you want to delete '{name}' and all of its expenses? This action cannot be undone.",
      confirm_reset_all: "All trips and data will be permanently cleared. Do you want to proceed?",
      confirm_delete_expense: "Are you sure you want to delete '{title}'?",
      err_title_req: "Please enter an expense title.",
      err_amount_positive: "Amount must be greater than 0.",
      err_general_save: "An error occurred while saving the expense.",
      err_at_least_one_split: "At least one person must be selected in split.",
      err_custom_sum_mismatch: "Custom shares sum ({sum}) must equal the total amount ({total})! Difference: {diff}",
      err_custom_excess: "Filled amounts sum ({sum}) exceeds total ({total})! Excess: {diff}",
      err_negative_share: "Custom amounts cannot be negative.",
      split_hybrid_summary: "Remainder {rem} → split equally among {count} people",
      split_hybrid_zero_rem: "Remainder 0.00 → other {count} people get 0.00",
      err_invalid_rate: "Please enter a valid positive exchange rate.",
      cat_food: "Food & Dining 🍔",
      cat_transport: "Transport & Fuel 🚕",
      cat_accommodation: "Accommodation & Hotel 🏨",
      cat_entertainment: "Entertainment & Tickets 🎟️",
      cat_other: "Other Expenses 📦",
      default_friend_prefix: "Friend",
      whatsapp_title: "📊 {tripName} - Expense Summary",
      whatsapp_total: "💰 Total Trip Cost: {total}",
      whatsapp_balances_title: "👥 Individual Balances:",
      whatsapp_transfers_title: "💸 Simplified Settlements (Who owes whom):",
      whatsapp_no_transfers: "✅ Everyone is all squared up!",
      whatsapp_footer: "⚡ Calculated with TripSplit"
    }
  };

  let currentLang = 'az';

  function initLang() {
    try {
      const saved = localStorage.getItem('tripsplit_lang');
      if (saved && (saved === 'az' || saved === 'en')) {
        currentLang = saved;
      }
    } catch (e) {
      // Fallback
    }
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (lang === 'az' || lang === 'en') {
      currentLang = lang;
      try {
        localStorage.setItem('tripsplit_lang', lang);
      } catch (e) {}
      if (window.TripSplit.app && typeof window.TripSplit.app.onLanguageChange === 'function') {
        window.TripSplit.app.onLanguageChange();
      }
    }
  }

  function t(key, params) {
    const dict = translations[currentLang] || translations.az;
    let text = dict[key] || translations.en[key] || key;
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return text;
  }

  initLang();

  window.TripSplit.i18n = {
    getLang,
    setLang,
    t,
    translations
  };
})();
