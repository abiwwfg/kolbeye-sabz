/* =========================================================
   سامانه تخصصی املاک کلبه سبز
   app.js
   نسخه هماهنگ با server.js
   ========================================================= */

   "use strict";

   /* =========================================================
      STORAGE KEYS
      ========================================================= */
   
   const STORAGE_KEYS = {
       currentUser: "currentUser",
       selectedProperty: "selectedProperty",
       editProperty: "editProperty",
       editingProperty: "editingProperty",
       customers: "customers",
       settings: "settings",
       customerPropertyLinks: "customerPropertyLinks"
   };
   
   
   /* =========================================================
      GLOBAL CACHE
      ========================================================= */
   
   let propertiesCache = [];
   let usersCache = [];
   let customersCache = [];
   
   
   /* =========================================================
      STORAGE HELPERS
      ========================================================= */
   
   function getStorage(key, fallback = null) {
   
       try {
   
           const value = localStorage.getItem(key);
   
           if (value === null) {
               return fallback;
           }
   
           return JSON.parse(value);
   
       } catch (error) {
   
           console.error("Storage read error:", error);
   
           return fallback;
       }
   }
   
   
   function setStorage(key, value) {
   
       try {
   
           localStorage.setItem(
               key,
               JSON.stringify(value)
           );
   
           return true;
   
       } catch (error) {
   
           console.error("Storage save error:", error);
   
           return false;
       }
   }
   
   
   function removeStorage(key) {
   
       try {
   
           localStorage.removeItem(key);
   
       } catch (error) {
   
           console.error("Storage remove error:", error);
       }
   }
   
   
   /* =========================================================
      HTML SECURITY
      ========================================================= */
   
   function escapeHTML(value) {
   
       if (
           value === undefined ||
           value === null
       ) {
           return "";
       }
   
       return String(value)
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
   }
   
   
   /* =========================================================
      NUMBER HELPERS
      ========================================================= */
   
   function normalizeNumber(value) {
   
       if (
           value === undefined ||
           value === null ||
           value === ""
       ) {
           return "";
       }
   
       let text = String(value);
   
       const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
       const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
   
       text = text.replace(
           /[۰-۹]/g,
           function(char) {
   
               return String(
                   persianDigits.indexOf(char)
               );
           }
       );
   
       text = text.replace(
           /[٠-٩]/g,
           function(char) {
   
               return String(
                   arabicDigits.indexOf(char)
               );
           }
       );
   
       text = text
           .replace(/,/g, "")
           .replace(/٬/g, "")
           .replace(/٫/g, ".")
           .replace(/[^\d.-]/g, "");
   
       if (text === "") {
           return "";
       }
   
       const number = Number(text);
   
       return Number.isNaN(number)
           ? ""
           : number;
   }
   
   
   function formatNumber(value) {
   
       const number = normalizeNumber(value);
   
       if (number === "") {
           return "-";
       }
   
       return number.toLocaleString("fa-IR");
   }
   
   
   function formatMoney(value) {
   
       const number = normalizeNumber(value);
   
       if (number === "") {
           return "ثبت نشده";
       }
   
       return (
           number.toLocaleString("fa-IR") +
           " تومان"
       );
   }
   
   
   /* =========================================================
      DATE HELPERS
      ========================================================= */
   
   function getPersianDate() {
   
       return new Date()
           .toLocaleDateString("fa-IR");
   }
   
   
   function getDateTime() {
   
       return new Date()
           .toLocaleString("fa-IR");
   }
   
   
   /* =========================================================
      API HELPER
      ========================================================= */
   
   async function apiRequest(url, options = {}) {
   
       const requestOptions = {
           credentials: "same-origin",
           ...options,
           headers: {
               ...(options.headers || {})
           }
       };
   
       /*
          فقط زمانی Content-Type را قرار می‌دهیم
          که body داشته باشیم.
       */
   
       if (
           requestOptions.body &&
           !requestOptions.headers["Content-Type"]
       ) {
   
           requestOptions.headers["Content-Type"] =
               "application/json";
       }
   
       try {
   
           const response =
               await fetch(
                   url,
                   requestOptions
               );
   
           let data = null;
   
           try {
   
               data = await response.json();
   
           } catch (error) {
   
               data = null;
           }
   
           if (response.status === 401) {
   
               removeStorage(
                   STORAGE_KEYS.currentUser
               );
   
               throw new Error(
                   "ابتدا وارد سامانه شوید"
               );
           }
   
           if (response.status === 403) {
   
               throw new Error(
                   data &&
                   data.message
                       ? data.message
                       : "دسترسی ندارید"
               );
           }
   
           if (!response.ok) {
   
               throw new Error(
                   data &&
                   data.message
                       ? data.message
                       : "خطا در ارتباط با سرور"
               );
           }
   
           return data;
   
       } catch (error) {
   
           console.error(
               "API Error:",
               error
           );
   
           throw error;
       }
   }
   
   
   /* =========================================================
      LOGIN
      ========================================================= */
   
   async function login() {
   
       const usernameElement =
           document.getElementById("username");
   
       const passwordElement =
           document.getElementById("password");
   
       if (
           !usernameElement ||
           !passwordElement
       ) {
   
           console.error(
               "فیلدهای ورود پیدا نشدند."
           );
   
           return;
       }
   
       const username =
           usernameElement.value.trim();
   
       const password =
           passwordElement.value;
   
       if (!username || !password) {
   
           alert(
               "نام کاربری و رمز عبور را وارد کنید."
           );
   
           return;
       }
   
       try {
   
           const result =
               await apiRequest(
                   "/api/login",
                   {
                       method: "POST",
   
                       body: JSON.stringify({
                           username: username,
                           password: password
                       })
                   }
               );
   
           if (
               !result ||
               !result.success
           ) {
   
               throw new Error(
                   result &&
                   result.message
                       ? result.message
                       : "ورود ناموفق بود"
               );
           }
   
           setStorage(
               STORAGE_KEYS.currentUser,
               result.user
           );
   
           window.location.href =
               "dashboard.html";
   
       } catch (error) {
   
           console.error(
               "Login error:",
               error
           );
   
           alert(
               error.message ||
               "خطا در ورود به سامانه"
           );
       }
   }
   
   
   /* =========================================================
      CURRENT USER
      ========================================================= */
   
   async function getCurrentUserFromServer() {
   
       try {
   
           const result =
               await apiRequest(
                   "/api/me"
               );
   
           if (
               result &&
               result.success &&
               result.user
           ) {
   
               setStorage(
                   STORAGE_KEYS.currentUser,
                   result.user
               );
   
               return result.user;
           }
   
           return null;
   
       } catch (error) {
   
           return null;
       }
   }
   
   
   function getCurrentUser() {
   
       return getStorage(
           STORAGE_KEYS.currentUser,
           null
       );
   }
   
   
   function getCurrentUserName() {
   
       const user =
           getCurrentUser();
   
       if (!user) {
           return "کاربر سامانه";
       }
   
       return (
           user.fullname ||
           user.fullName ||
           user.name ||
           user.username ||
           "کاربر سامانه"
       );
   }
   
   
   function getCurrentUserRole() {
   
       const user =
           getCurrentUser();
   
       if (!user) {
           return "";
       }
   
       return user.role || "";
   }
   
   
   async function checkAuthentication() {
   
       const user =
           await getCurrentUserFromServer();
   
       return !!user;
   }
   
   
   /* =========================================================
      LOGOUT
      ========================================================= */
   
   async function logout() {
   
       try {
   
           await fetch(
               "/api/logout",
               {
                   method: "POST",
                   credentials: "same-origin"
               }
           );
   
       } catch (error) {
   
           console.error(
               "Logout error:",
               error
           );
   
       } finally {
   
           removeStorage(
               STORAGE_KEYS.currentUser
           );
   
           removeStorage(
               STORAGE_KEYS.selectedProperty
           );
   
           removeStorage(
               STORAGE_KEYS.editProperty
           );
   
           removeStorage(
               STORAGE_KEYS.editingProperty
           );
   
           window.location.href =
               "index.html";
       }
   }
   
   
   /* =========================================================
      USERS
      ========================================================= */
   
   async function getUsers() {
   
       try {
   
           const result =
               await apiRequest(
                   "/api/users"
               );
   
           if (
               result &&
               result.success &&
               Array.isArray(result.users)
           ) {
   
               usersCache =
                   result.users;
   
               return result.users;
           }
   
           return [];
   
       } catch (error) {
   
           console.error(
               "Get users error:",
               error
           );
   
           return [];
       }
   }
   
   
   /*
      این تابع فقط برای سازگاری با کدهای قدیمی است.
      ذخیره واقعی کاربران توسط server.js انجام می‌شود.
   */
   
   function saveUsers(users) {
   
       usersCache =
           Array.isArray(users)
               ? users
               : [];
   
       return true;
   }
   
   
   /* =========================================================
      CREATE USER
      ========================================================= */
   
   async function createUser(userData) {
   
       if (
           !userData ||
           typeof userData !== "object"
       ) {
   
           throw new Error(
               "اطلاعات کاربر نامعتبر است."
           );
       }
   
       const result =
           await apiRequest(
               "/api/users",
               {
                   method: "POST",
   
                   body:
                       JSON.stringify(
                           userData
                       )
               }
           );
   
       if (
           !result ||
           !result.success
       ) {
   
           throw new Error(
               result &&
               result.message
                   ? result.message
                   : "خطا در ایجاد کاربر"
           );
       }
   
       if (result.user) {
   
           usersCache.push(
               result.user
           );
       }
   
       return result.user;
   }
   
   
   /* =========================================================
      DELETE USER
      ========================================================= */
   
   async function deleteUserById(userId) {
   
       if (!userId) {
   
           throw new Error(
               "شناسه کاربر مشخص نیست."
           );
       }
   
       const result =
           await apiRequest(
               "/api/users/" +
               encodeURIComponent(userId),
               {
                   method: "DELETE"
               }
           );
   
       if (
           !result ||
           !result.success
       ) {
   
           throw new Error(
               result &&
               result.message
                   ? result.message
                   : "خطا در حذف کاربر"
           );
       }
   
       usersCache =
           usersCache.filter(
               function(user) {
   
                   return String(user.id) !==
                       String(userId);
               }
           );
   
       return true;
   }
   
   
   /* =========================================================
      PROPERTIES
      ========================================================= */
   
   async function getProperties() {
   
       try {
   
           const result =
               await apiRequest(
                   "/api/properties"
               );
   
           if (
               result &&
               result.success &&
               Array.isArray(
                   result.properties
               )
           ) {
   
               propertiesCache =
                   result.properties;
   
               return result.properties;
           }
   
           propertiesCache = [];
   
           return [];
   
       } catch (error) {
   
           console.error(
               "Get properties error:",
               error
           );
   
           return [];
       }
   }
   
   
   /*
      فقط Cache را تغییر می‌دهد.
      ذخیره واقعی از طریق API انجام می‌شود.
   */
   
   function saveProperties(properties) {
   
       propertiesCache =
           Array.isArray(properties)
               ? properties
               : [];
   
       return true;
   }
   
   
   /* =========================================================
      PROPERTY ID
      ========================================================= */
   
   function generatePropertyId() {
   
       return (
           "property-" +
           Date.now() +
           "-" +
           Math.random()
               .toString(36)
               .substring(2, 8)
       );
   }
   
   
   function generatePropertyCode() {
   
       const now =
           new Date();
   
       const year =
           now.getFullYear();
   
       const month =
           String(
               now.getMonth() + 1
           ).padStart(2, "0");
   
       const day =
           String(
               now.getDate()
           ).padStart(2, "0");
   
       const random =
           String(
               Date.now()
           ).slice(-6);
   
       return (
           "KS-" +
           year +
           month +
           day +
           "-" +
           random
       );
   }
   
   
   /* =========================================================
      PROPERTY IDENTIFIER
      ========================================================= */
   
   function getPropertyIdentifier(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.id ??
           property.code ??
           property.propertyCode ??
           ""
       );
   }
   
   
   /* =========================================================
      PROPERTY GETTERS
      ========================================================= */
   
   function getPropertyRegion(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.region ??
           property.areaName ??
           property.district ??
           property.zone ??
           ""
       );
   }
   
   
   function getPropertyNeighborhood(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.neighborhood ??
           property.locality ??
           property.mohalle ??
           ""
       );
   }
   
   
   function getPropertyArea(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.area ??
           property.metraj ??
           property.meterage ??
           property.meter ??
           property.size ??
           ""
       );
   }
   
   
   function getPropertyTransaction(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.transactionType ??
           property.dealType ??
           property.transaction ??
           property.typeOfTransaction ??
           ""
       );
   }
   
   
   function getPropertyType(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.propertyType ??
           property.typeOfProperty ??
           property.propertyTypeName ??
           property.type ??
           ""
       );
   }
   
   
   function getPropertyRooms(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.rooms ??
           property.bedrooms ??
           property.room ??
           ""
       );
   }
   
   
   function getPropertyFloor(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.floor ??
           property.tabaghe ??
           ""
       );
   }
   
   
   function getPropertyDirection(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.direction ??
           property.unitDirection ??
           property.jahat ??
           ""
       );
   }
   
   
   function getPropertyBuildYear(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.buildYear ??
           property.yearBuilt ??
           property.sakhtYear ??
           ""
       );
   }
   
   
   function getPropertyUnitsPerFloor(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.unitsPerFloor ??
           property.unitsInFloor ??
           ""
       );
   }
   
   
   function getPropertyBuildingArea(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.buildingArea ??
           property.builtArea ??
           property.ayan ??
           ""
       );
   }
   
   
   function getPropertyLandArea(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.landArea ??
           property.ersah ??
           property.araz ??
           ""
       );
   }
   
   
   function getPropertyDirectionText(property) {
   
       return getPropertyDirection(
           property
       );
   }
   
   
   function getPropertyPrice(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.price ??
           property.salePrice ??
           property.totalPrice ??
           property.sellPrice ??
           ""
       );
   }
   
   
   function getPropertyDeposit(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.deposit ??
           property.rahn ??
           property.rentDeposit ??
           ""
       );
   }
   
   
   function getPropertyRent(property) {
   
       if (!property) {
           return "";
       }
   
       return (
           property.rent ??
           property.ejare ??
           property.monthlyRent ??
           ""
       );
   }
   
   
   /* =========================================================
      IMAGES
      ========================================================= */
   
   function getPropertyImages(property) {
   
       if (
           property &&
           Array.isArray(property.images)
       ) {
   
           return property.images;
       }
   
       if (
           property &&
           Array.isArray(property.photos)
       ) {
   
           return property.photos;
       }
   
       return [];
   }
   
   
   /* =========================================================
      FEATURES
      ========================================================= */
   
   const FEATURE_NAMES = {
   
       elevator: "آسانسور",
       parking: "پارکینگ",
       storage: "انباری",
       balcony: "بالکن",
       terrace: "تراس",
       pool: "استخر",
       sauna: "سونا",
       jacuzzi: "جکوزی",
       gym: "سالن ورزشی",
   
       closet: "کمد دیواری",
       cabinet: "کابینت MDF",
       highGlossCabinet: "کابینت هایگلاس",
   
       package: "پکیج",
       radiator: "رادیاتور",
       floorHeating: "گرمایش از کف",
       airCondition: "کولر گازی",
   
       doubleGlass: "پنجره دوجداره",
   
       securityDoor: "درب ضد سرقت",
   
       intercom: "آیفون تصویری",
   
       roofGarden: "روف گاردن",
   
       camera: "دوربین مداربسته",
   
       guard: "نگهبانی"
   };
   
   
   function getPropertyFeatures(property) {
   
       if (
           property &&
           Array.isArray(property.features)
       ) {
   
           return property.features;
       }
   
       if (
           property &&
           property.features &&
           typeof property.features === "object"
       ) {
   
           return Object.keys(
               property.features
           ).filter(
               function(key) {
   
                   return property.features[key];
               }
           );
       }
   
       return [];
   }
   
   
   function getFeatureNames(features) {
   
       if (!Array.isArray(features)) {
           return [];
       }
   
       return features.map(
           function(feature) {
   
               return (
                   FEATURE_NAMES[feature] ||
                   feature
               );
           }
       );
   }
   
   
   /* =========================================================
      PROPERTY NORMALIZER
      ========================================================= */
   
   function normalizeProperty(property) {
   
       if (!property) {
           return null;
       }
   
       return {
   
           ...property,
   
           id:
               property.id ||
               generatePropertyId(),
   
           code:
               property.code ||
               property.propertyCode ||
               generatePropertyCode(),
   
           propertyType:
               getPropertyType(property),
   
           transactionType:
               getPropertyTransaction(property),
   
           region:
               getPropertyRegion(property),
   
           neighborhood:
               getPropertyNeighborhood(property),
   
           area:
               getPropertyArea(property),
   
           rooms:
               getPropertyRooms(property),
   
           floor:
               getPropertyFloor(property),
   
           direction:
               getPropertyDirection(property),
   
           buildYear:
               getPropertyBuildYear(property),
   
           unitsPerFloor:
               getPropertyUnitsPerFloor(property),
   
           buildingArea:
               getPropertyBuildingArea(property),
   
           landArea:
               getPropertyLandArea(property),
   
           price:
               getPropertyPrice(property),
   
           deposit:
               getPropertyDeposit(property),
   
           rent:
               getPropertyRent(property),
   
           images:
               getPropertyImages(property),
   
           features:
               getPropertyFeatures(property),
   
           createdBy:
               property.createdBy ||
               property.consultant ||
               getCurrentUserName(),
   
           createdAt:
               property.createdAt ||
               getPersianDate()
       };
   }
   
   
   /* =========================================================
      ADD PROPERTY
      ========================================================= */
   
   async function addProperty(propertyData) {
   
       if (
           !propertyData ||
           typeof propertyData !== "object"
       ) {
   
           throw new Error(
               "اطلاعات ملک نامعتبر است."
           );
       }
   
       /*
          نکته مهم:
          id / code / createdAt / createdBy
          در server.js مدیریت می‌شوند.
       */
   
       const cleanData = {
           ...propertyData
       };
   
       /*
          اگر id قدیمی در فرم وجود داشته باشد
          ارسال نمی‌کنیم.
       */
   
       delete cleanData.id;
   
       delete cleanData.createdAt;
   
       delete cleanData.createdBy;
   
       delete cleanData.createdById;
   
       delete cleanData.updatedAt;
   
       delete cleanData.updatedBy;
   
       delete cleanData.updatedById;
   
       /*
          code اگر از فرم وجود داشته باشد
          حفظ می‌شود.
       */
   
       const result =
           await apiRequest(
               "/api/properties",
               {
                   method: "POST",
   
                   body:
                       JSON.stringify(
                           cleanData
                       )
               }
           );
   
       if (
           !result ||
           !result.success
       ) {
   
           throw new Error(
               result &&
               result.message
                   ? result.message
                   : "خطا در ثبت ملک"
           );
       }
   
       if (result.property) {
   
           propertiesCache.push(
               result.property
           );
       }
   
       return result.property;
   }
   
   
   /* =========================================================
      UPDATE PROPERTY
      ========================================================= */
   
   async function updateProperty(
       propertyId,
       propertyData
   ) {
   
       if (!propertyId) {
   
           throw new Error(
               "شناسه ملک مشخص نیست."
           );
       }
   
       if (
           !propertyData ||
           typeof propertyData !== "object"
       ) {
   
           throw new Error(
               "اطلاعات ویرایش نامعتبر است."
           );
       }
   
       const cleanData = {
           ...propertyData
       };
   
       /*
          موارد اصلی توسط server.js
          کنترل می‌شوند.
       */
   
       delete cleanData.id;
   
       delete cleanData.createdAt;
   
       delete cleanData.createdBy;
   
       delete cleanData.createdById;
   
       delete cleanData.updatedAt;
   
       delete cleanData.updatedBy;
   
       delete cleanData.updatedById;
   
       const result =
           await apiRequest(
               "/api/properties/" +
               encodeURIComponent(
                   propertyId
               ),
               {
                   method: "PUT",
   
                   body:
                       JSON.stringify(
                           cleanData
                       )
               }
           );
   
       if (
           !result ||
           !result.success
       ) {
   
           throw new Error(
               result &&
               result.message
                   ? result.message
                   : "خطا در ویرایش ملک"
           );
       }
   
       if (result.property) {
   
           const index =
               propertiesCache.findIndex(
                   function(property) {
   
                       return String(
                           getPropertyIdentifier(
                               property
                           )
                       ) ===
                       String(propertyId);
                   }
               );
   
           if (index >= 0) {
   
               propertiesCache[index] =
                   result.property;
   
           } else {
   
               propertiesCache.push(
                   result.property
               );
           }
       }
   
       return result.property;
   }
   
   
   /* =========================================================
      DELETE PROPERTY
      ========================================================= */
   
   async function deletePropertyById(propertyId) {
   
       if (!propertyId) {
   
           throw new Error(
               "شناسه ملک مشخص نیست."
           );
       }
   
       const result =
           await apiRequest(
               "/api/properties/" +
               encodeURIComponent(
                   propertyId
               ),
               {
                   method: "DELETE"
               }
           );
   
       if (
           !result ||
           !result.success
       ) {
   
           throw new Error(
               result &&
               result.message
                   ? result.message
                   : "خطا در حذف ملک"
           );
       }
   
       propertiesCache =
           propertiesCache.filter(
               function(property) {
   
                   return String(
                       getPropertyIdentifier(
                           property
                       )
                   ) !==
                   String(propertyId);
               }
           );
   
       removePropertyLinks(
           propertyId
       );
   
       return true;
   }
   
   
   /* =========================================================
      FIND PROPERTY
      ========================================================= */
   
   async function findProperty(propertyId) {
   
       if (!propertyId) {
           return null;
       }
   
       try {
   
           const result =
               await apiRequest(
                   "/api/properties/" +
                   encodeURIComponent(
                       propertyId
                   )
               );
   
           if (
               result &&
               result.success
           ) {
   
               return result.property;
           }
   
       } catch (error) {
   
           console.error(
               "Find property error:",
               error
           );
       }
   
       return null;
   }
   
   
   /* =========================================================
      SELECTED PROPERTY
      ========================================================= */
   
   function setSelectedProperty(property) {
   
       return setStorage(
           STORAGE_KEYS.selectedProperty,
           property
       );
   }
   
   
   function getSelectedProperty() {
   
       return getStorage(
           STORAGE_KEYS.selectedProperty,
           null
       );
   }
   
   
   /* =========================================================
      EDIT PROPERTY
      ========================================================= */
   
   function setEditProperty(property) {
   
       return setStorage(
           STORAGE_KEYS.editProperty,
           property
       );
   }
   
   
   function getEditProperty() {
   
       return getStorage(
           STORAGE_KEYS.editProperty,
           null
       );
   }
   
   
   /* =========================================================
      PRICE HTML
      ========================================================= */
   
   function getPriceHTML(property) {
   
       const type =
           String(
               getPropertyTransaction(
                   property
               )
           ).trim();
   
       const price =
           getPropertyPrice(property);
   
       const deposit =
           getPropertyDeposit(property);
   
       const rent =
           getPropertyRent(property);
   
       if (
           type.includes("رهن") &&
           type.includes("اجاره")
       ) {
   
           return `
   
               <div>
   
                   <small>رهن</small>
   
                   <br>
   
                   ${formatMoney(
                       deposit
                   )}
   
               </div>
   
               <div style="margin-top:8px;">
   
                   <small>اجاره</small>
   
                   <br>
   
                   ${formatMoney(
                       rent
                   )}
   
               </div>
   
           `;
       }
   
       if (type.includes("رهن")) {
   
           return formatMoney(
               deposit
           );
       }
   
       if (type.includes("اجاره")) {
   
           return formatMoney(
               rent
           );
       }
   
       return formatMoney(
           price
       );
   }
   
   
   /* =========================================================
      CUSTOMERS
      ========================================================= */
   
   function getCustomers() {
   
       const customers =
           getStorage(
               STORAGE_KEYS.customers,
               []
           );
   
       customersCache =
           Array.isArray(customers)
               ? customers
               : [];
   
       return customersCache;
   }
   
   
   function saveCustomers(customers) {
   
       customersCache =
           Array.isArray(customers)
               ? customers
               : [];
   
       return setStorage(
           STORAGE_KEYS.customers,
           customersCache
       );
   }
   
   
   function findCustomer(customerId) {
   
       return getCustomers().find(
           function(customer) {
   
               return String(
                   customer.id
               ) ===
               String(customerId);
           }
       );
   }
   
   
   /* =========================================================
      CUSTOMER ↔ PROPERTY LINKS
      ========================================================= */
   
   function getCustomerPropertyLinks() {
   
       const links =
           getStorage(
               STORAGE_KEYS.customerPropertyLinks,
               []
           );
   
       return Array.isArray(links)
           ? links
           : [];
   }
   
   
   function saveCustomerPropertyLinks(links) {
   
       return setStorage(
           STORAGE_KEYS.customerPropertyLinks,
           Array.isArray(links)
               ? links
               : []
       );
   }
   
   
   function createCustomerPropertyLink(
       customerId,
       propertyId,
       note = ""
   ) {
   
       const links =
           getCustomerPropertyLinks();
   
       const exists =
           links.some(
               function(link) {
   
                   return (
                       String(
                           link.customerId
                       ) ===
                       String(customerId)
   
                       &&
   
                       String(
                           link.propertyId
                       ) ===
                       String(propertyId)
                   );
               }
           );
   
       if (exists) {
           return false;
       }
   
       links.push({
   
           id:
               "link-" +
               Date.now() +
               "-" +
               Math.random()
                   .toString(36)
                   .substring(2, 7),
   
           customerId:
               customerId,
   
           propertyId:
               propertyId,
   
           note:
               note,
   
           createdAt:
               getDateTime(),
   
           createdBy:
               getCurrentUserName()
       });
   
       return saveCustomerPropertyLinks(
           links
       );
   }
   
   
   function removeCustomerPropertyLink(
       customerId,
       propertyId
   ) {
   
       const links =
           getCustomerPropertyLinks();
   
       const filtered =
           links.filter(
               function(link) {
   
                   return !(
                       String(
                           link.customerId
                       ) ===
                       String(customerId)
   
                       &&
   
                       String(
                           link.propertyId
                       ) ===
                       String(propertyId)
                   );
               }
           );
   
       if (
           filtered.length ===
           links.length
       ) {
   
           return false;
       }
   
       return saveCustomerPropertyLinks(
           filtered
       );
   }
   
   
   function removePropertyLinks(propertyId) {
   
       const links =
           getCustomerPropertyLinks();
   
       const filtered =
           links.filter(
               function(link) {
   
                   return String(
                       link.propertyId
                   ) !==
                   String(propertyId);
               }
           );
   
       return saveCustomerPropertyLinks(
           filtered
       );
   }
   
   
   function getCustomerProperties(customerId) {
   
       const links =
           getCustomerPropertyLinks();
   
       const properties =
           propertiesCache;
   
       const propertyIds =
           links
               .filter(
                   function(link) {
   
                       return String(
                           link.customerId
                       ) ===
                       String(customerId);
                   }
               )
               .map(
                   function(link) {
   
                       return String(
                           link.propertyId
                       );
                   }
               );
   
       return properties.filter(
           function(property) {
   
               return propertyIds.includes(
                   String(
                       getPropertyIdentifier(
                           property
                       )
                   )
               );
           }
       );
   }
   
   
   function getPropertyCustomers(propertyId) {
   
       const links =
           getCustomerPropertyLinks();
   
       const customers =
           getCustomers();
   
       const customerIds =
           links
               .filter(
                   function(link) {
   
                       return String(
                           link.propertyId
                       ) ===
                       String(propertyId);
                   }
               )
               .map(
                   function(link) {
   
                       return String(
                           link.customerId
                       );
                   }
               );
   
       return customers.filter(
           function(customer) {
   
               return customerIds.includes(
                   String(customer.id)
               );
           }
       );
   }
   
   
   /* =========================================================
      ADVANCED PROPERTY SEARCH
      ========================================================= */
   
   function searchProperties(filters = {}) {
   
       const properties =
           propertiesCache;
   
       const searchText =
           String(
               filters.search || ""
           )
           .trim()
           .toLowerCase();
   
       const transaction =
           String(
               filters.transactionType || ""
           );
   
       const propertyType =
           String(
               filters.propertyType || ""
           );
   
       const region =
           String(
               filters.region || ""
           )
           .trim()
           .toLowerCase();
   
       const neighborhood =
           String(
               filters.neighborhood || ""
           )
           .trim()
           .toLowerCase();
   
       const minArea =
           normalizeNumber(
               filters.minArea
           );
   
       const maxArea =
           normalizeNumber(
               filters.maxArea
           );
   
       const minPrice =
           normalizeNumber(
               filters.minPrice
           );
   
       const maxPrice =
           normalizeNumber(
               filters.maxPrice
           );
   
       const rooms =
           String(
               filters.rooms || ""
           );
   
       const floor =
           String(
               filters.floor || ""
           );
   
       const direction =
           String(
               filters.direction || ""
           );
   
       const requiredFeatures =
           Array.isArray(filters.features)
               ? filters.features
               : [];
   
       return properties.filter(
           function(property) {
   
               const normalized =
                   normalizeProperty(
                       property
                   );
   
               if (!normalized) {
                   return false;
               }
   
               if (searchText) {
   
                   const searchableText = [
   
                       normalized.code,
                       normalized.propertyType,
                       normalized.transactionType,
                       normalized.region,
                       normalized.neighborhood,
                       normalized.rooms,
                       normalized.floor,
                       normalized.direction,
                       normalized.createdBy
   
                   ]
                   .join(" ")
                   .toLowerCase();
   
                   if (
                       !searchableText.includes(
                           searchText
                       )
                   ) {
   
                       return false;
                   }
               }
   
               if (
                   transaction &&
                   normalized.transactionType !==
                   transaction
               ) {
   
                   return false;
               }
   
               if (
                   propertyType &&
                   normalized.propertyType !==
                   propertyType
               ) {
   
                   return false;
               }
   
               if (
                   region &&
                   !String(
                       normalized.region
                   )
                   .toLowerCase()
                   .includes(region)
               ) {
   
                   return false;
               }
   
               if (
                   neighborhood &&
                   !String(
                       normalized.neighborhood
                   )
                   .toLowerCase()
                   .includes(neighborhood)
               ) {
   
                   return false;
               }
   
               const area =
                   normalizeNumber(
                       normalized.area
                   );
   
               if (
                   minArea !== "" &&
                   (
                       area === "" ||
                       area < minArea
                   )
               ) {
   
                   return false;
               }
   
               if (
                   maxArea !== "" &&
                   (
                       area === "" ||
                       area > maxArea
                   )
               ) {
   
                   return false;
               }
   
               const price =
                   normalizeNumber(
                       normalized.price
                   );
   
               if (
                   minPrice !== "" &&
                   (
                       price === "" ||
                       price < minPrice
                   )
               ) {
   
                   return false;
               }
   
               if (
                   maxPrice !== "" &&
                   (
                       price === "" ||
                       price > maxPrice
                   )
               ) {
   
                   return false;
               }
   
               if (
                   rooms &&
                   String(
                       normalized.rooms
                   ) !== rooms
               ) {
   
                   return false;
               }
   
               if (
                   floor &&
                   String(
                       normalized.floor
                   ) !== floor
               ) {
   
                   return false;
               }
   
               if (
                   direction &&
                   String(
                       normalized.direction
                   ) !== direction
               ) {
   
                   return false;
               }
   
               if (
                   requiredFeatures.length
               ) {
   
                   const propertyFeatures =
                       getPropertyFeatures(
                           normalized
                       );
   
                   const hasAllFeatures =
                       requiredFeatures.every(
                           function(feature) {
   
                               return propertyFeatures.includes(
                                   feature
                               );
                           }
                       );
   
                   if (!hasAllFeatures) {
                       return false;
                   }
               }
   
               return true;
           }
       );
   }
   
   
   /* =========================================================
      SORT PROPERTIES
      ========================================================= */
   
   function getSortableDate(property) {
   
       if (!property) {
           return 0;
       }
   
       if (property.createdAt) {
   
           const timestamp =
               new Date(
                   property.createdAt
               ).getTime();
   
           if (!Number.isNaN(timestamp)) {
               return timestamp;
           }
       }
   
       const id =
           String(
               property.id ||
               ""
           );
   
       const match =
           id.match(
               /(?:property-|KS-\d+-?)(\d+)/
           );
   
       if (match) {
   
           return Number(
               match[1]
           );
       }
   
       return 0;
   }
   
   
   function sortProperties(
       properties,
       sort = "newest"
   ) {
   
       const list =
           Array.isArray(properties)
               ? [...properties]
               : [];
   
       list.sort(
           function(a, b) {
   
               if (
                   sort === "newest"
               ) {
   
                   return (
                       getSortableDate(b) -
                       getSortableDate(a)
                   );
               }
   
               if (
                   sort === "oldest"
               ) {
   
                   return (
                       getSortableDate(a) -
                       getSortableDate(b)
                   );
               }
   
               const areaA =
                   normalizeNumber(
                       getPropertyArea(a)
                   ) || 0;
   
               const areaB =
                   normalizeNumber(
                       getPropertyArea(b)
                   ) || 0;
   
               if (
                   sort === "areaHigh"
               ) {
   
                   return areaB - areaA;
               }
   
               if (
                   sort === "areaLow"
               ) {
   
                   return areaA - areaB;
               }
   
               const priceA =
                   normalizeNumber(
                       getPropertyPrice(a)
                   ) || 0;
   
               const priceB =
                   normalizeNumber(
                       getPropertyPrice(b)
                   ) || 0;
   
               if (
                   sort === "priceHigh"
               ) {
   
                   return priceB - priceA;
               }
   
               if (
                   sort === "priceLow"
               ) {
   
                   return priceA - priceB;
               }
   
               return 0;
           }
       );
   
       return list;
   }
   
   
   /* =========================================================
      DASHBOARD STATS
      ========================================================= */
   
   function getDashboardStats() {
   
       const properties =
           propertiesCache;
   
       const customers =
           getCustomers();
   
       const sale =
           properties.filter(
               function(property) {
   
                   return String(
                       getPropertyTransaction(
                           property
                       )
                   ).includes("فروش");
               }
           ).length;
   
       const rent =
           properties.filter(
               function(property) {
   
                   return String(
                       getPropertyTransaction(
                           property
                       )
                   ).includes("اجاره");
               }
           ).length;
   
       const rahn =
           properties.filter(
               function(property) {
   
                   return String(
                       getPropertyTransaction(
                           property
                       )
                   ).includes("رهن");
               }
           ).length;
   
       return {
   
           total:
               properties.length,
   
           sale:
               sale,
   
           rent:
               rent,
   
           rahn:
               rahn,
   
           customers:
               customers.length,
   
           users:
               usersCache.length
       };
   }
   
   
   /* =========================================================
      REPORT DATA
      ========================================================= */
   
   function getReportData() {
   
       const properties =
           propertiesCache;
   
       const customers =
           getCustomers();
   
       const propertyTypes = {};
       const transactions = {};
       const regions = {};
       const consultants = {};
   
       properties.forEach(
           function(property) {
   
               const type =
                   getPropertyType(
                       property
                   ) ||
                   "نامشخص";
   
               const transaction =
                   getPropertyTransaction(
                       property
                   ) ||
                   "نامشخص";
   
               const region =
                   getPropertyRegion(
                       property
                   ) ||
                   "نامشخص";
   
               const consultant =
                   property.createdBy ||
                   "نامشخص";
   
               propertyTypes[type] =
                   (
                       propertyTypes[type] ||
                       0
                   ) + 1;
   
               transactions[transaction] =
                   (
                       transactions[
                           transaction
                       ] ||
                       0
                   ) + 1;
   
               regions[region] =
                   (
                       regions[region] ||
                       0
                   ) + 1;
   
               consultants[consultant] =
                   (
                       consultants[
                           consultant
                       ] ||
                       0
                   ) + 1;
           }
       );
   
       const areas =
           properties
               .map(
                   function(property) {
   
                       return normalizeNumber(
                           getPropertyArea(
                               property
                           )
                       );
                   }
               )
               .filter(
                   function(value) {
   
                       return value !== "";
                   }
               );
   
       const totalArea =
           areas.reduce(
               function(sum, value) {
   
                   return sum + value;
   
               },
               0
           );
   
       const averageArea =
           areas.length
               ? totalArea / areas.length
               : 0;
   
       return {
   
           totalProperties:
               properties.length,
   
           totalCustomers:
               customers.length,
   
           propertyTypes:
               propertyTypes,
   
           transactions:
               transactions,
   
           regions:
               regions,
   
           consultants:
               consultants,
   
           totalArea:
               totalArea,
   
           averageArea:
               averageArea
       };
   }
   
   
   /* =========================================================
      SETTINGS
      ========================================================= */
   
   const DEFAULT_SETTINGS = {
   
       systemName:
           "سامانه تخصصی املاک کلبه سبز",
   
       agencyName:
           "کلبه سبز",
   
       phone:
           "",
   
       address:
           "",
   
       currency:
           "تومان",
   
       darkMode:
           false,
   
       showImages:
           true,
   
       autoSave:
           true
   };
   
   
   function getSettings() {
   
       const settings =
           getStorage(
               STORAGE_KEYS.settings,
               {}
           );
   
       return {
   
           ...DEFAULT_SETTINGS,
   
           ...(settings || {})
       };
   }
   
   
   function saveSettings(settings) {
   
       return setStorage(
           STORAGE_KEYS.settings,
           {
   
               ...DEFAULT_SETTINGS,
   
               ...(settings || {})
           }
       );
   }
   
   
   function updateSetting(
       key,
       value
   ) {
   
       const settings =
           getSettings();
   
       settings[key] =
           value;
   
       return saveSettings(
           settings
       );
   }
   
   
   /* =========================================================
      CUSTOMER MATCHING
      ========================================================= */
   
   function matchCustomerToProperties(customer) {
   
       if (!customer) {
           return [];
       }
   
       const properties =
           propertiesCache;
   
       return properties.filter(
           function(property) {
   
               const normalized =
                   normalizeProperty(
                       property
                   );
   
               if (!normalized) {
                   return false;
               }
   
               if (
                   customer.propertyType &&
                   normalized.propertyType &&
                   customer.propertyType !==
                   normalized.propertyType
               ) {
   
                   return false;
               }
   
               if (
                   customer.dealType &&
                   normalized.transactionType &&
                   customer.dealType !==
                   normalized.transactionType
               ) {
   
                   return false;
               }
   
               if (
                   customer.region &&
                   normalized.region &&
                   !String(
                       normalized.region
                   ).includes(
                       String(
                           customer.region
                       )
                   )
               ) {
   
                   return false;
               }
   
               const minBudget =
                   normalizeNumber(
                       customer.minBudget
                   );
   
               const maxBudget =
                   normalizeNumber(
                       customer.maxBudget
                   );
   
               const price =
                   normalizeNumber(
                       normalized.price
                   );
   
               if (
                   minBudget !== "" &&
                   price !== "" &&
                   price < minBudget
               ) {
   
                   return false;
               }
   
               if (
                   maxBudget !== "" &&
                   price !== "" &&
                   price > maxBudget
               ) {
   
                   return false;
               }
   
               if (
                   customer.rooms &&
                   normalized.rooms &&
                   String(
                       customer.rooms
                   ) !==
                   String(
                       normalized.rooms
                   )
               ) {
   
                   return false;
               }
   
               return true;
           }
       );
   }
   
   
   /* =========================================================
      TEMPORARY DATA
      ========================================================= */
   
   function clearTemporaryPropertyData() {
   
       removeStorage(
           STORAGE_KEYS.selectedProperty
       );
   
       removeStorage(
           STORAGE_KEYS.editProperty
       );
   
       removeStorage(
           STORAGE_KEYS.editingProperty
       );
   }
   
   
   /* =========================================================
      PAGE INITIALIZATION
      ========================================================= */
   
   async function initializePage() {
   
       const currentPage =
           window.location.pathname
               .split("/")
               .pop()
               .toLowerCase();
   
       /*
          صفحات ورود
       */
   
       if (
           currentPage === "index.html" ||
           currentPage === "login.html" ||
           currentPage === ""
       ) {
   
           return;
       }
   
       /*
          دریافت Session
       */
   
       const user =
           await getCurrentUserFromServer();
   
       /*
          اگر Session وجود نداشت
          به صفحه ورود برگرد.
       */
   
       if (!user) {
   
           window.location.href =
               "index.html";
   
           return;
       }
   
       /*
          نمایش نام کاربر
       */
   
       const userName =
           document.getElementById(
               "currentUserName"
           );
   
       if (userName) {
   
           userName.textContent =
               getCurrentUserName();
       }
   
       /*
          دریافت املاک
       */
   
       try {
   
           await getProperties();
   
       } catch (error) {
   
           console.error(
               "Property initialization error:",
               error
           );
       }
   
       /*
          دریافت کاربران فقط در صفحه users
       */
   
       if (
           currentPage === "users.html"
       ) {
   
           try {
   
               await getUsers();
   
           } catch (error) {
   
               console.error(
                   "Users initialization error:",
                   error
               );
           }
       }
   
       /*
          آمار داشبورد
       */
   
       const stats =
           getDashboardStats();
   
       const totalProperties =
           document.getElementById(
               "totalProperties"
           );
   
       if (totalProperties) {
   
           totalProperties.textContent =
               formatNumber(
                   stats.total
               );
       }
   
       const saleProperties =
           document.getElementById(
               "saleProperties"
           );
   
       if (saleProperties) {
   
           saleProperties.textContent =
               formatNumber(
                   stats.sale
               );
       }
   
       const rentProperties =
           document.getElementById(
               "rentProperties"
           );
   
       if (rentProperties) {
   
           rentProperties.textContent =
               formatNumber(
                   stats.rent
               );
       }
   
       const rahnProperties =
           document.getElementById(
               "rahnProperties"
           );
   
       if (rahnProperties) {
   
           rahnProperties.textContent =
               formatNumber(
                   stats.rahn
               );
       }
   
       const totalCustomers =
           document.getElementById(
               "totalCustomers"
           );
   
       if (totalCustomers) {
   
           totalCustomers.textContent =
               formatNumber(
                   stats.customers
               );
       }
   
       /*
          تعداد کاربران
       */
   
       const totalUsers =
           document.getElementById(
               "totalUsers"
           );
   
       if (totalUsers) {
   
           /*
              فقط اگر قبلاً کاربران
              دریافت شده باشند.
           */
   
           totalUsers.textContent =
               formatNumber(
                   stats.users
               );
       }
   }
   
   
   /* =========================================================
      DOM READY
      ========================================================= */
   
   document.addEventListener(
       "DOMContentLoaded",
       function() {
   
           initializePage();
   
       }
   );
   
   
   /* =========================================================
      GLOBAL EXPORTS
      ========================================================= */
   
   window.STORAGE_KEYS =
       STORAGE_KEYS;
   
   
   /* STORAGE */
   
   window.getStorage =
       getStorage;
   
   window.setStorage =
       setStorage;
   
   window.removeStorage =
       removeStorage;
   
   
   /* SECURITY */
   
   window.escapeHTML =
       escapeHTML;
   
   
   /* NUMBER */
   
   window.normalizeNumber =
       normalizeNumber;
   
   window.formatNumber =
       formatNumber;
   
   window.formatMoney =
       formatMoney;
   
   
   /* DATE */
   
   window.getPersianDate =
       getPersianDate;
   
   window.getDateTime =
       getDateTime;
   
   
   /* API */
   
   window.apiRequest =
       apiRequest;
   
   
   /* LOGIN */
   
   window.login =
       login;
   
   window.logout =
       logout;
   
   window.getCurrentUser =
       getCurrentUser;
   
   window.getCurrentUserName =
       getCurrentUserName;
   
   window.getCurrentUserRole =
       getCurrentUserRole;
   
   window.getCurrentUserFromServer =
       getCurrentUserFromServer;
   
   window.checkAuthentication =
       checkAuthentication;
   
   
   /* USERS */
   
   window.getUsers =
       getUsers;
   
   window.saveUsers =
       saveUsers;
   
   window.createUser =
       createUser;
   
   window.deleteUserById =
       deleteUserById;
   
   
   /* PROPERTIES */
   
   window.getProperties =
       getProperties;
   
   window.saveProperties =
       saveProperties;
   
   window.generatePropertyId =
       generatePropertyId;
   
   window.generatePropertyCode =
       generatePropertyCode;
   
   window.getPropertyIdentifier =
       getPropertyIdentifier;
   
   window.getPropertyRegion =
       getPropertyRegion;
   
   window.getPropertyNeighborhood =
       getPropertyNeighborhood;
   
   window.getPropertyArea =
       getPropertyArea;
   
   window.getPropertyTransaction =
       getPropertyTransaction;
   
   window.getPropertyType =
       getPropertyType;
   
   window.getPropertyRooms =
       getPropertyRooms;
   
   window.getPropertyFloor =
       getPropertyFloor;
   
   window.getPropertyDirection =
       getPropertyDirection;
   
   window.getPropertyBuildYear =
       getPropertyBuildYear;
   
   window.getPropertyUnitsPerFloor =
       getPropertyUnitsPerFloor;
   
   window.getPropertyBuildingArea =
       getPropertyBuildingArea;
   
   window.getPropertyLandArea =
       getPropertyLandArea;
   
   window.getPropertyDirectionText =
       getPropertyDirectionText;
   
   window.getPropertyPrice =
       getPropertyPrice;
   
   window.getPropertyDeposit =
       getPropertyDeposit;
   
   window.getPropertyRent =
       getPropertyRent;
   
   
   /* IMAGES */
   
   window.getPropertyImages =
       getPropertyImages;
   
   
   /* FEATURES */
   
   window.FEATURE_NAMES =
       FEATURE_NAMES;
   
   window.getPropertyFeatures =
       getPropertyFeatures;
   
   window.getFeatureNames =
       getFeatureNames;
   
   
   /* PROPERTY ACTIONS */
   
   window.normalizeProperty =
       normalizeProperty;
   
   window.addProperty =
       addProperty;
   
   window.updateProperty =
       updateProperty;
   
   window.deletePropertyById =
       deletePropertyById;
   
   window.findProperty =
       findProperty;
   
   
   /* SELECTED / EDIT */
   
   window.setSelectedProperty =
       setSelectedProperty;
   
   window.getSelectedProperty =
       getSelectedProperty;
   
   window.setEditProperty =
       setEditProperty;
   
   window.getEditProperty =
       getEditProperty;
   
   
   /* PRICE */
   
   window.getPriceHTML =
       getPriceHTML;
   
   
   /* CUSTOMERS */
   
   window.getCustomers =
       getCustomers;
   
   window.saveCustomers =
       saveCustomers;
   
   window.findCustomer =
       findCustomer;
   
   
   /* CUSTOMER ↔ PROPERTY */
   
   window.getCustomerPropertyLinks =
       getCustomerPropertyLinks;
   
   window.saveCustomerPropertyLinks =
       saveCustomerPropertyLinks;
   
   window.createCustomerPropertyLink =
       createCustomerPropertyLink;
   
   window.removeCustomerPropertyLink =
       removeCustomerPropertyLink;
   
   window.removePropertyLinks =
       removePropertyLinks;
   
   window.getCustomerProperties =
       getCustomerProperties;
   
   window.getPropertyCustomers =
       getPropertyCustomers;
   
   
   /* SEARCH */
   
   window.searchProperties =
       searchProperties;
   
   window.sortProperties =
       sortProperties;
   
   
   /* DASHBOARD */
   
   window.getDashboardStats =
       getDashboardStats;
   
   
   /* REPORTS */
   
   window.getReportData =
       getReportData;
   
   
   /* SETTINGS */
   
   window.DEFAULT_SETTINGS =
       DEFAULT_SETTINGS;
   
   window.getSettings =
       getSettings;
   
   window.saveSettings =
       saveSettings;
   
   window.updateSetting =
       updateSetting;
   
   
   /* MATCHING */
   
   window.matchCustomerToProperties =
       matchCustomerToProperties;
   
   
   /* CLEANUP */
   
   window.clearTemporaryPropertyData =
       clearTemporaryPropertyData;
   
   
   /* =========================================================
      END OF APP.JS
      ========================================================= */