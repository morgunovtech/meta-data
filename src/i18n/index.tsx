import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Language = 'ru' | 'en' | 'uz';

type Messages = typeof messages.ru;

type I18nContextValue = {
  lang: Language;
  messages: Messages;
  setLanguage: (lang: Language) => void;
};

const messages = {
  ru: {
    appTitle: 'Анализ метаданных и приватности фото',
    introLead: 'Этот инструмент помогает понять, какие скрытые данные и контекст сопровождают ваши фотографии.',
    introHow: 'Загрузите или перетащите снимок: мы анализируем метаданные локально и запрашиваем дополнительный контекст через защищённые прокси.',
    introSafe: 'Изображение никогда не покидает браузер. Серверу передаются только координаты, время съёмки и другие примитивы.',
    privacyPolicy: 'Политика конфиденциальности',
    sourceCode: 'Исходный код',
    uploadTitle: 'Загрузка снимка',
    uploadButton: 'Выбрать файл',
    orDrop: 'или перетащите сюда',
    fileTooLarge: 'Слишком большой файл (> {limit} МБ). Сожмите фото или выберите другое.',
    unsupportedFormat: 'Неподдерживаемый формат. Подойдут JPEG/PNG/WebP.',
    corruptedFile: 'Файл повреждён. Попробуйте заново.',
    unsupportedHeic: 'HEIC пока не поддерживается. Пожалуйста, конвертируйте снимок в JPEG/PNG/WebP.',
    basicInfoTitle: 'Основные данные файла',
    nameLabel: 'Имя файла',
    typeLabel: 'Тип',
    formatLabel: 'Формат',
    sizeLabel: 'Размер',
    sizeExactBytes: '{value} байт',
    fileTypeImage: 'Изображение',
    fileTypeUnknown: 'Неизвестно',
    dimensionsLabel: 'Размеры',
    megapixelsLabel: 'Мегапиксели',
    orientationLabel: 'Ориентация',
    metadataSummary: 'Сводка метаданных',
    exifGroup: 'EXIF теги',
    xmpGroup: 'XMP теги',
    iptcGroup: 'IPTC теги',
    iccGroup: 'ICC профиль',
    shotDate: 'Дата и время съёмки',
    cameraMake: 'Производитель',
    cameraModel: 'Модель камеры',
    lensModel: 'Объектив',
    exposure: 'Выдержка',
    aperture: 'Диафрагма',
    iso: 'ISO',
    focalLength: 'Фокусное расстояние',
    gpsPresence: 'GPS-координаты',
    gpsAvailable: 'есть',
    gpsMissing: 'нет',
    gpsAccuracy: 'Точность GPS',
    metadataCompleteness: 'Заполненность метаданных',
    orientationPortrait: 'портрет',
    orientationLandscape: 'альбом',
    orientationSquare: 'квадрат',
    orientationUnknown: 'неизвестно',
    shockBlockTitle: 'Что можно узнать из данных',
    timezoneTitle: 'Местное время и праздники',
    timezoneMissing: 'Нет данных о времени съёмки.',
    timezoneLoading: 'Определяем местное время…',
    timezoneError: 'Сейчас не получается получить сведения о часовом поясе. Это не критично: базовые функции работают локально.',
    retry: 'Повторить',
    holidayYes: 'Праздник',
    holidayNo: 'Обычный день',
    mapTitle: 'Карта и адрес',
    mapMissing: 'GPS в метаданных отсутствует. Можно указать координаты вручную.',
    mapLoading: 'Получаем адрес…',
    reverseError: 'Сейчас не получается получить адрес. Это не критично: базовые функции работают локально.',
    addressLabel: 'Адрес',
    countryLabel: 'Страна',
    coordinatesLabel: 'Координаты',
    accuracyLabel: 'Точность',
    openMaps: 'Открыть в Google Maps',
    openStreetView: 'Посмотреть в Street View',
    weatherTitle: 'Погодные условия',
    weatherMissing: 'Нужны GPS и время съёмки, чтобы показать погоду.',
    weatherLoading: 'Запрашиваем погодные данные…',
    weatherError: 'Сейчас не получается получить погоду. Это не критично: базовые функции работают локально.',
    weatherSummary: 'Темп. {temperature}°C · Осадки {precipitation} мм · Облачность {cloudCover}% · Ветер {windSpeed} км/ч · Давление {pressure} гПа',
    poiTitle: 'Что рядом',
    poiLoading: 'Ищем объекты поблизости…',
    poiError: 'Сейчас не получается получить объекты поблизости.',
    poiEmpty: 'Не найдено значимых объектов в радиусе 250 м.',
    surveillanceTitle: 'Вероятные камеры наблюдения',
    surveillanceLoading: 'Ищем камеры и наблюдение поблизости…',
    surveillanceEmpty: 'Данных о наблюдении поблизости не найдено.',
    contentAnalysisTitle: 'Анализ содержимого',
    contentLoading: 'Загрузка модели…',
    contentUnavailable: 'Ваше устройство не поддерживает анализ содержимого. Метаданные доступны полностью.',
    contentResults: 'Описание сцены',
    contentNoDetections: 'Объекты не обнаружены.',
    cleanupTitle: 'Очистка и загрузка',
    removeMetadata: 'Удалить метаданные',
    blurFaces: 'Размыть лица/людей',
    downloadClean: 'Очистить данные и скачать',
    qualityLabel: 'Качество JPEG',
    manualInput: 'Указать координаты вручную',
    manualLat: 'Широта',
    manualLon: 'Долгота',
    applyManual: 'Применить',
    cleanUnavailable: 'Загрузите фото, чтобы очистить и скачать.',
    language: 'Язык',
    themeLabel: 'Тема',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    themeSystem: 'Авто',
    fullscreenClose: 'Закрыть просмотр',
    facesMissing: 'Нет обнаруженных лиц — размывать нечего.',
    downloadReady: 'Файл готов: началась загрузка.',
    processing: 'Обработка…',
    modelSummary: '{people} чел · {vehicles} транспорт · {animals} животные',
    timezoneResult: 'Местное время: {time} ({timezone}).',
    holidayResult: 'Праздник: {holiday}',
    accuracyMeters: '{value} м',
    retryHint: 'Повторить запрос',
    emptyValue: '—',
    reset: 'Сбросить',
    cleanupHint: 'Файл перекодируется локально: метаданные будут удалены, размытие использует найденные рамки людей.',
    narrativeCaptured: 'Снято на {device}',
    narrativeLens: 'Объектив: {lens}',
    narrativeSoftware: 'Обработка: {software}',
    narrativeXmp: 'Есть XMP-данные — снимок редактировался.',
    narrativeIcc: 'Встроен ICC-профиль.',
    narrativeInsufficient: 'Недостаточно данных, чтобы восстановить цепочку обработки.',
    cleanupFailed: 'Не удалось подготовить файл. Попробуйте заново.'
  },
  en: {
    appTitle: 'Photo metadata & privacy analyzer',
    introLead: 'Understand which hidden data and context travel with your photos.',
    introHow: 'Upload or drop a picture: we read metadata locally and fetch extra context via hardened proxies.',
    introSafe: 'The image never leaves the browser. Only coordinates, timestamps, and similar primitives reach the serverless functions.',
    privacyPolicy: 'Privacy policy',
    sourceCode: 'Source code',
    uploadTitle: 'Upload photo',
    uploadButton: 'Select file',
    orDrop: 'or drop here',
    fileTooLarge: 'File is too large (> {limit} MB). Compress it or choose another photo.',
    unsupportedFormat: 'Unsupported format. JPEG/PNG/WebP only.',
    corruptedFile: 'Corrupted file. Please try again.',
    unsupportedHeic: 'HEIC is not supported yet. Convert it to JPEG/PNG/WebP first.',
    basicInfoTitle: 'File information',
    nameLabel: 'File name',
    typeLabel: 'Type',
    formatLabel: 'Format',
    sizeLabel: 'Size',
    sizeExactBytes: '{value} bytes',
    fileTypeImage: 'Image',
    fileTypeUnknown: 'Unknown',
    dimensionsLabel: 'Dimensions',
    megapixelsLabel: 'Megapixels',
    orientationLabel: 'Orientation',
    metadataSummary: 'Metadata summary',
    exifGroup: 'EXIF tags',
    xmpGroup: 'XMP tags',
    iptcGroup: 'IPTC tags',
    iccGroup: 'ICC profile',
    shotDate: 'Capture time',
    cameraMake: 'Manufacturer',
    cameraModel: 'Camera model',
    lensModel: 'Lens model',
    exposure: 'Exposure',
    aperture: 'Aperture',
    iso: 'ISO',
    focalLength: 'Focal length',
    gpsPresence: 'GPS coordinates',
    gpsAvailable: 'present',
    gpsMissing: 'missing',
    gpsAccuracy: 'GPS accuracy',
    metadataCompleteness: 'Metadata completeness',
    orientationPortrait: 'portrait',
    orientationLandscape: 'landscape',
    orientationSquare: 'square',
    orientationUnknown: 'unknown',
    shockBlockTitle: 'What can be inferred',
    timezoneTitle: 'Local time & holidays',
    timezoneMissing: 'No capture time available.',
    timezoneLoading: 'Resolving timezone…',
    timezoneError: 'Timezone lookup failed. Core features continue to work offline.',
    retry: 'Retry',
    holidayYes: 'Holiday',
    holidayNo: 'Regular day',
    mapTitle: 'Map & address',
    mapMissing: 'No GPS metadata. Provide coordinates manually if needed.',
    mapLoading: 'Resolving address…',
    reverseError: 'Reverse geocoding failed. Core features continue to work offline.',
    addressLabel: 'Address',
    countryLabel: 'Country',
    coordinatesLabel: 'Coordinates',
    accuracyLabel: 'Accuracy',
    openMaps: 'Open in Google Maps',
    openStreetView: 'View in Street View',
    weatherTitle: 'Weather snapshot',
    weatherMissing: 'Need GPS and capture time to show weather.',
    weatherLoading: 'Requesting weather data…',
    weatherError: 'Weather lookup failed. Core features continue to work offline.',
    weatherSummary: 'Temp {temperature}°C · Precip {precipitation} mm · Clouds {cloudCover}% · Wind {windSpeed} km/h · Pressure {pressure} hPa',
    poiTitle: 'Nearby points of interest',
    poiLoading: 'Scanning for POIs…',
    poiError: 'Unable to load nearby POIs right now.',
    poiEmpty: 'No notable POIs within 250 m.',
    surveillanceTitle: 'Possible surveillance',
    surveillanceLoading: 'Looking for surveillance points…',
    surveillanceEmpty: 'No obvious surveillance near the spot.',
    contentAnalysisTitle: 'Content analysis',
    contentLoading: 'Loading model…',
    contentUnavailable: 'Your device seems too weak for content analysis; metadata tools still work.',
    contentResults: 'Scene summary',
    contentNoDetections: 'No objects detected.',
    cleanupTitle: 'Cleanup & download',
    removeMetadata: 'Strip metadata',
    blurFaces: 'Blur faces/people',
    downloadClean: 'Clean data & download',
    qualityLabel: 'JPEG quality',
    manualInput: 'Provide coordinates manually',
    manualLat: 'Latitude',
    manualLon: 'Longitude',
    applyManual: 'Apply',
    cleanUnavailable: 'Upload a photo to clean & download.',
    language: 'Language',
    themeLabel: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'Auto',
    fullscreenClose: 'Close viewer',
    facesMissing: 'No faces detected — nothing to blur.',
    downloadReady: 'File ready — download started.',
    processing: 'Processing…',
    modelSummary: '{people} people · {vehicles} vehicles · {animals} animals',
    timezoneResult: 'Local time: {time} ({timezone}).',
    holidayResult: 'Holiday: {holiday}',
    accuracyMeters: '{value} m',
    retryHint: 'Retry request',
    emptyValue: '—',
    reset: 'Reset',
    cleanupHint: 'The file is re-encoded locally to remove metadata; blur uses detected people boxes.',
    narrativeCaptured: 'Captured on {device}',
    narrativeLens: 'Lens: {lens}',
    narrativeSoftware: 'Processed with {software}',
    narrativeXmp: 'XMP metadata present — likely edited.',
    narrativeIcc: 'ICC profile embedded.',
    narrativeInsufficient: 'Insufficient data to reconstruct the processing history.',
    cleanupFailed: 'Could not generate the cleaned file. Please try again.'
  },
  uz: {
    appTitle: 'Foto metadata va maxfiylik tahlili',
    introLead: 'Fotosuratlaringiz bilan birga ketadigan yashirin maʼlumotlarni biling.',
    introHow: 'Rasmni yuklang yoki tortib tashlang: metamaʼlumotlarni brauzerda o‘qiymiz, qo‘shimcha kontekstni xavfsiz proksilar orqali olamiz.',
    introSafe: 'Tasvir brauzerdan chiqmaydi. Serverless funksiyalarga faqat koordinatalar, vaqtlar va shunga o‘xshash mayda parametrlar yuboriladi.',
    privacyPolicy: 'Maxfiylik siyosati',
    sourceCode: 'Manba kodi',
    uploadTitle: 'Rasm yuklash',
    uploadButton: 'Fayl tanlash',
    orDrop: 'yoki shu yerga tashlang',
    fileTooLarge: 'Fayl juda katta (> {limit} MB). Uni siqib oling yoki boshqa surat tanlang.',
    unsupportedFormat: 'Format qo‘llab-quvvatlanmaydi. Faqat JPEG/PNG/WebP.',
    corruptedFile: 'Fayl buzilgan. Qayta urinib ko‘ring.',
    unsupportedHeic: 'HEIC hali qo‘llab-quvvatlanmaydi. Avval uni JPEG/PNG/WebP formatiga o‘tkazing.',
    basicInfoTitle: 'Fayl haqida maʼlumot',
    nameLabel: 'Fayl nomi',
    typeLabel: 'Turi',
    formatLabel: 'Format',
    sizeLabel: 'Hajmi',
    sizeExactBytes: '{value} bayt',
    fileTypeImage: 'Rasm',
    fileTypeUnknown: 'Nomaʼlum',
    dimensionsLabel: 'O‘lchamlar',
    megapixelsLabel: 'Megapiksellar',
    orientationLabel: 'Yo‘nalish',
    metadataSummary: 'Metamaʼlumotlar hisobot',
    exifGroup: 'EXIF teglar',
    xmpGroup: 'XMP teglar',
    iptcGroup: 'IPTC teglar',
    iccGroup: 'ICC profil',
    shotDate: 'Suratga olish vaqti',
    cameraMake: 'Ishlab chiqaruvchi',
    cameraModel: 'Kamera modeli',
    lensModel: 'Obʼektiv',
    exposure: 'Ekspozitsiya',
    aperture: 'Diafragma',
    iso: 'ISO',
    focalLength: 'Fokus masofasi',
    gpsPresence: 'GPS koordinatalari',
    gpsAvailable: 'bor',
    gpsMissing: 'yo‘q',
    gpsAccuracy: 'GPS aniqligi',
    metadataCompleteness: 'Metamaʼlumotlar to‘liqligi',
    orientationPortrait: 'portret',
    orientationLandscape: 'landshaft',
    orientationSquare: 'kvadrat',
    orientationUnknown: 'nomaʼlum',
    shockBlockTitle: 'Maʼlumotlardan olinadigan xulosalar',
    timezoneTitle: 'Mahalliy vaqt va bayramlar',
    timezoneMissing: 'Surat vaqti mavjud emas.',
    timezoneLoading: 'Vaqt zonasini aniqlash…',
    timezoneError: 'Vaqt zonasi olishda xatolik. Asosiy funksiyalar baribir ishlaydi.',
    retry: 'Qayta urinish',
    holidayYes: 'Bayram',
    holidayNo: 'Oddiy kun',
    mapTitle: 'Xarita va manzil',
    mapMissing: 'GPS metamaʼlumotlari yo‘q. Kerak bo‘lsa koordinatlarni qo‘lda kiriting.',
    mapLoading: 'Manzil olinmoqda…',
    reverseError: 'Manzilni olish muvaffaqiyatsiz. Asosiy funksiyalar ishlashda davom etadi.',
    addressLabel: 'Manzil',
    countryLabel: 'Mamlakat',
    coordinatesLabel: 'Koordinatalar',
    accuracyLabel: 'Aniqlik',
    openMaps: 'Google Maps’da ochish',
    openStreetView: 'Street View’da ko‘rish',
    weatherTitle: 'Ob-havo maʼlumoti',
    weatherMissing: 'Ob-havo uchun GPS va surat vaqti kerak.',
    weatherLoading: 'Ob-havo maʼlumotlari so‘ralmoqda…',
    weatherError: 'Ob-havo maʼlumotlari olinmadi. Asosiy funksiyalar ishlashda davom etadi.',
    weatherSummary: 'Harorat {temperature}°C · Yog‘ingarchilik {precipitation} mm · Bulutlilik {cloudCover}% · Shamol {windSpeed} km/soat · Bosim {pressure} hPa',
    poiTitle: 'Yaqin joylar',
    poiLoading: 'Yaqin POI qidirilmoqda…',
    poiError: 'Hozircha yaqin joylar olinmadi.',
    poiEmpty: '250 m radiusda muhim joylar topilmadi.',
    surveillanceTitle: 'Ehtimoliy kuzatuv nuqtalari',
    surveillanceLoading: 'Kuzatuv nuqtalari qidirilmoqda…',
    surveillanceEmpty: 'Yaqqol kuzatuv vositalari topilmadi.',
    contentAnalysisTitle: 'Kontent tahlili',
    contentLoading: 'Model yuklanmoqda…',
    contentUnavailable: 'Qurilmangiz kontent tahliliga tayyor emas — metamaʼlumotlar baribir mavjud.',
    contentResults: 'Sahna tavsifi',
    contentNoDetections: 'Obʼektlar topilmadi.',
    cleanupTitle: 'Tozalash va yuklab olish',
    removeMetadata: 'Metamaʼlumotlarni olib tashlash',
    blurFaces: 'Yuz/odamlarni xira qilish',
    downloadClean: 'Tozalash va yuklab olish',
    qualityLabel: 'JPEG sifati',
    manualInput: 'Koordinatlarni qo‘lda kiriting',
    manualLat: 'Kenglik',
    manualLon: 'Uzunlik',
    applyManual: 'Qo‘llash',
    cleanUnavailable: 'Tozalash uchun avval surat yuklang.',
    language: 'Til',
    themeLabel: 'Ko‘rinish rejimi',
    themeLight: 'Yorug‘',
    themeDark: 'Qorong‘i',
    themeSystem: 'Avto',
    fullscreenClose: 'Yopish',
    facesMissing: 'Yuzlar aniqlanmadi — xira qilish shart emas.',
    downloadReady: 'Fayl tayyor — yuklab olinmoqda.',
    processing: 'Qayta ishlanmoqda…',
    modelSummary: '{people} kishi · {vehicles} transport · {animals} hayvon',
    timezoneResult: 'Mahalliy vaqt: {time} ({timezone}).',
    holidayResult: 'Bayram: {holiday}',
    accuracyMeters: '{value} m',
    retryHint: 'Qayta so‘rov',
    emptyValue: '—',
    reset: 'Tozalash',
    cleanupHint: 'Fayl lokal ravishda qayta kodlanadi: metamaʼlumotlar o‘chiriladi, xiralash tirikchilik topilgan odamlar bo‘yicha.',
    narrativeCaptured: '{device} qurilmasida suratga olingan',
    narrativeLens: 'Obʼektiv: {lens}',
    narrativeSoftware: '{software} orqali qayta ishlangan',
    narrativeXmp: 'XMP maʼlumotlari mavjud — ehtimol tahrir qilingan.',
    narrativeIcc: 'ICC profili biriktirilgan.',
    narrativeInsufficient: 'Ishlov berish tarixini tiklash uchun maʼlumot yetarli emas.',
    cleanupFailed: 'Faylni qayta tayyorlab bo‘lmadi. Iltimos, qayta urinib ko‘ring.'
  }
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const LANG_STORAGE_KEY = 'meta-data-lang';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === 'undefined') {
      return 'ru';
    }
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'ru' || stored === 'en' || stored === 'uz') {
      return stored;
    }
    return 'ru';
  });

  const setLanguage = useCallback((next: Language) => {
    setLang(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    messages: messages[lang],
    setLanguage
  }), [lang, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
};

export type MessageKey = keyof typeof messages.ru;

export const useT = () => {
  const { messages: dict } = useI18n();
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>): string => {
      const template = dict[key];
      if (!template) {
        return key;
      }
      if (!params) {
        return template;
      }
      return Object.entries(params).reduce(
        (acc, [paramKey, paramValue]) => acc.replace(`{${paramKey}}`, String(paramValue)),
        template
      );
    },
    [dict]
  );
};

export type MessagesMap = typeof messages;
export { messages };
