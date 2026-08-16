/* =========================================================
   سامانه تخصصی املاک کلبه سبز
   app.js - نسخه بازنویسی و اصلاح‌شده
   ========================================================= */

   "use strict";

   /* =========================================================
      STORAGE KEYS
   ========================================================= */
   
   const STORAGE_KEYS = {
       properties: "properties",
       users: "users",
       customers: "customers",
       currentUser: "currentUser",
       selectedProperty: "selectedProperty",
       editProperty: "editProperty",
       editingProperty: "editingProperty",
       settings: "settings",
       customerPropertyLinks: "customerPropertyLinks"
   };
   
   
   /* =========================================================
      STORAGE
   ========================================================= */
   
   function getStorage(key, fallback = null) {
       try {
           const value = localStorage.getItem(key);
   
           if (value === null) {
               return fallback;
           }
   
           const parsed = JSON.parse(value);
   
           return parsed ?? fallback;
   
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
   
       if (value === undefined || value === null) {
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
   
       // تبدیل اعداد فارسی
       const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
       const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
   
       text = text.replace(/[۰-۹]/g, function(char) {
           return String(
               persianDigits.indexOf(char)
           );
       });
   
       // تبدیل اعداد عربی
       text = text.replace(/[٠-٩]/g, function(char) {
           return String(
               arabicDigits.indexOf(char)
           );
       });
   
       // تبدیل جداکننده‌ها
       text = text
           .replace(/٬/g, "")
           .replace(/,/g, "")
           .replace(/٫/g, ".")
           .replace(/[^\d.-]/g, "");
   
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
   
       return number.toLocaleString("fa-IR") + " تومان";
   }
   
   
   /* =========================================================
      DATE
   ========================================================= */
   
   function getPersianDate() {
       return new Date().toLocaleDateString("fa-IR");
   }
   
   
   function getDateTime() {
       return new Date().toLocaleString("fa-IR");
   }
   
   
   /* =========================================================
      USER
   ========================================================= */
   
   function getUsers() {
   
       const users = getStorage(
           STORAGE_KEYS.users,
           []
       );
   
       return Array.isArray(users)
           ? users
           : [];
   }
   
   
   function saveUsers(users) {
       return setStorage(
           STORAGE_KEYS.users,
           users
       );
   }
   
   
   function getCurrentUser() {
   
       return getStorage(
           STORAGE_KEYS.currentUser,
           null
       );
   }
   
   
   function getCurrentUserName() {
   
       const user = getCurrentUser();
   
       if (!user) {
           return "کاربر سامانه";
       }
   
       return (
           user.name ||
           user.fullName ||
           user.username ||
           "کاربر سامانه"
       );
   }
   
   
   function logout() {
   
       removeStorage(
           STORAGE_KEYS.currentUser
       );
   
       window.location.href = "index.html";
   }
   
   
   /* =========================================================
      PROPERTY STORAGE
   ========================================================= */
   
   function getProperties() {
   
       const properties = getStorage(
           STORAGE_KEYS.properties,
           []
       );
   
       return Array.isArray(properties)
           ? properties
           : [];
   }
   
   
   function saveProperties(properties) {
   
       return setStorage(
           STORAGE_KEYS.properties,
           properties
       );
   }
   
   
   /* =========================================================
      PROPERTY IDs
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
   
       const now = new Date();
   
       const year = now.getFullYear();
   
       const month = String(
           now.getMonth() + 1
       ).padStart(2, "0");
   
       const day = String(
           now.getDate()
       ).padStart(2, "0");
   
       const random = String(
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
      PROPERTY GETTERS
   ========================================================= */
   
   function getPropertyRegion(property) {
   
       return (
           property?.region ??
           property?.areaName ??
           property?.district ??
           property?.zone ??
           ""
       );
   }
   
   
   function getPropertyNeighborhood(property) {
   
       return (
           property?.neighborhood ??
           property?.locality ??
           property?.mohalle ??
           ""
       );
   }
   
   
   function getPropertyArea(property) {
   
       return (
           property?.area ??
           property?.metraj ??
           property?.meterage ??
           property?.meter ??
           property?.size ??
           ""
       );
   }
   
   
   function getPropertyTransaction(property) {
   
       return (
           property?.transactionType ??
           property?.dealType ??
           property?.transaction ??
           property?.typeOfTransaction ??
           ""
       );
   }
   
   
   function getPropertyType(property) {
   
       return (
           property?.propertyType ??
           property?.typeOfProperty ??
           property?.propertyTypeName ??
           property?.type ??
           ""
       );
   }
   
   
   function getPropertyRooms(property) {
   
       return (
           property?.rooms ??
           property?.bedrooms ??
           property?.room ??
           ""
       );
   }
   
   
   function getPropertyFloor(property) {
   
       return (
           property?.floor ??
           property?.tabaghe ??
           ""
       );
   }
   
   
   function getPropertyDirection(property) {
   
       return (
           property?.direction ??
           property?.unitDirection ??
           property?.jahat ??
           ""
       );
   }
   
   
   function getPropertyBuildYear(property) {
   
       return (
           property?.buildYear ??
           property?.yearBuilt ??
           property?.sakhtYear ??
           ""
       );
   }
   
   
   function getPropertyUnitsPerFloor(property) {
   
       return (
           property?.unitsPerFloor ??
           property?.unitsInFloor ??
           ""
       );
   }
   
   
   function getPropertyBuildingArea(property) {
   
       return (
           property?.buildingArea ??
           property?.builtArea ??
           property?.ayan ??
           ""
       );
   }
   
   
   function getPropertyLandArea(property) {
   
       return (
           property?.landArea ??
           property?.ersah ??
           property?.araz ??
           ""
       );
   }
   
   
   function getPropertyPrice(property) {
   
       return (
           property?.price ??
           property?.salePrice ??
           property?.totalPrice ??
           property?.sellPrice ??
           ""
       );
   }
   
   
   function getPropertyDeposit(property) {
   
       return (
           property?.deposit ??
           property?.rahn ??
           property?.rentDeposit ??
           ""
       );
   }
   
   
   function getPropertyRent(property) {
   
       return (
           property?.rent ??
           property?.ejare ??
           property?.monthlyRent ??
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
           ).filter(function(key) {
   
               return property.features[key];
   
           });
   
       }
   
       return [];
   }
   
   
   function getFeatureNames(features) {
   
       if (!Array.isArray(features)) {
           return [];
       }
   
       return features.map(function(feature) {
   
           return (
               FEATURE_NAMES[feature] ||
               feature
           );
   
       });
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
   
   function addProperty(propertyData) {
   
       const properties =
           getProperties();
   
       const property =
           normalizeProperty(propertyData);
   
       if (!property) {
           throw new Error(
               "اطلاعات ملک نامعتبر است."
           );
       }
   
       properties.push(property);
   
       saveProperties(properties);
   
       return property;
   }
   
   
   /* =========================================================
      UPDATE PROPERTY
   ========================================================= */
   
   function updateProperty(
       propertyId,
       propertyData
   ) {
   
       const properties =
           getProperties();
   
       const index =
           properties.findIndex(function(property) {
   
               return String(
                   property.id ??
                   property.code ??
                   property.propertyCode
               ) === String(propertyId);
   
           });
   
       if (index === -1) {
           return false;
       }
   
       const oldProperty =
           properties[index];
   
       const updated =
           normalizeProperty({
   
               ...oldProperty,
               ...propertyData,
   
               id:
                   oldProperty.id,
   
               code:
                   oldProperty.code,
   
               createdAt:
                   oldProperty.createdAt,
   
               createdBy:
                   oldProperty.createdBy
   
           });
   
       properties[index] =
           updated;
   
       saveProperties(properties);
   
       return true;
   }
   
   
   /* =========================================================
      DELETE PROPERTY
   ========================================================= */
   
   function deletePropertyById(propertyId) {
   
       const properties =
           getProperties();
   
       const filtered =
           properties.filter(function(property) {
   
               return String(
                   property.id ??
                   property.code ??
                   property.propertyCode
               ) !== String(propertyId);
   
           });
   
       if (
           filtered.length ===
           properties.length
       ) {
           return false;
       }
   
       saveProperties(filtered);
   
       removePropertyLinks(propertyId);
   
       return true;
   }
   
   
   /* =========================================================
      FIND PROPERTY
   ========================================================= */
   
   function findProperty(propertyId) {
   
       return getProperties().find(
           function(property) {
   
               return String(
                   property.id ??
                   property.code ??
                   property.propertyCode
               ) === String(propertyId);
   
           }
       );
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
               getPropertyTransaction(property)
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
                   ${escapeHTML(formatMoney(deposit))}
               </div>
   
               <div style="margin-top:8px;">
                   <small>اجاره</small>
                   <br>
                   ${escapeHTML(formatMoney(rent))}
               </div>
           `;
       }
   
   
       if (type.includes("رهن")) {
           return escapeHTML(
               formatMoney(deposit)
           );
       }
   
   
       if (type.includes("اجاره")) {
           return escapeHTML(
               formatMoney(rent)
           );
       }
   
   
       return escapeHTML(
           formatMoney(price)
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
   
       return Array.isArray(customers)
           ? customers
           : [];
   }
   
   
   function saveCustomers(customers) {
   
       return setStorage(
           STORAGE_KEYS.customers,
           customers
       );
   }
   
   
   function addCustomer(customerData) {
   
       if (!customerData) {
           return null;
       }
   
       const customers =
           getCustomers();
   
       const customer = {
   
           ...customerData,
   
           id:
               customerData.id ||
               "customer-" +
               Date.now(),
   
           createdAt:
               customerData.createdAt ||
               getDateTime()
       };
   
       customers.push(customer);
   
       saveCustomers(customers);
   
       return customer;
   }
   
   
   function findCustomer(customerId) {
   
       return getCustomers().find(
           function(customer) {
   
               return String(
                   customer.id
               ) === String(customerId);
   
           }
       );
   }
   
   
   function updateCustomer(
       customerId,
       customerData
   ) {
   
       const customers =
           getCustomers();
   
       const index =
           customers.findIndex(
               function(customer) {
   
                   return String(
                       customer.id
                   ) === String(customerId);
   
               }
           );
   
       if (index === -1) {
           return false;
       }
   
       customers[index] = {
   
           ...customers[index],
           ...customerData,
   
           id:
               customers[index].id
   
       };
   
       saveCustomers(customers);
   
       return true;
   }
   
   
   function deleteCustomer(customerId) {
   
       const customers =
           getCustomers();
   
       const filtered =
           customers.filter(
               function(customer) {
   
                   return String(
                       customer.id
                   ) !== String(customerId);
   
               }
           );
   
       if (
           filtered.length ===
           customers.length
       ) {
           return false;
       }
   
       saveCustomers(filtered);
   
       return true;
   }
   
   
   /* =========================================================
      CUSTOMER - PROPERTY LINKS
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
           links
       );
   }
   
   
   function linkCustomerToProperty(
       customerId,
       propertyId
   ) {
   
       const links =
           getCustomerPropertyLinks();
   
       const exists =
           links.some(function(link) {
   
               return (
                   String(link.customerId) ===
                   String(customerId) &&
                   String(link.propertyId) ===
                   String(propertyId)
               );
   
           });
   
       if (exists) {
           return false;
       }
   
       links.push({
   
           customerId:
               customerId,
   
           propertyId:
               propertyId,
   
           createdAt:
               getDateTime()
   
       });
   
       saveCustomerPropertyLinks(links);
   
       return true;
   }
   
   
   function unlinkCustomerFromProperty(
       customerId,
       propertyId
   ) {
   
       const links =
           getCustomerPropertyLinks();
   
       const filtered =
           links.filter(function(link) {
   
               return !(
                   String(link.customerId) ===
                   String(customerId) &&
   
                   String(link.propertyId) ===
                   String(propertyId)
               );
   
           });
   
       saveCustomerPropertyLinks(filtered);
   
       return true;
   }
   
   
   function getPropertiesForCustomer(customerId) {
   
       const links =
           getCustomerPropertyLinks();
   
       const propertyIds =
           links
               .filter(function(link) {
   
                   return String(
                       link.customerId
                   ) === String(customerId);
   
               })
               .map(function(link) {
   
                   return String(
                       link.propertyId
                   );
   
               });
   
       return getProperties().filter(
           function(property) {
   
               return propertyIds.includes(
                   String(
                       property.id ??
                       property.code ??
                       property.propertyCode
                   )
               );
   
           }
       );
   }
   
   
   function getCustomersForProperty(propertyId) {
   
       const links =
           getCustomerPropertyLinks();
   
       const customerIds =
           links
               .filter(function(link) {
   
                   return String(
                       link.propertyId
                   ) === String(propertyId);
   
               })
               .map(function(link) {
   
                   return String(
                       link.customerId
                   );
   
               });
   
       return getCustomers().filter(
           function(customer) {
   
               return customerIds.includes(
                   String(customer.id)
               );
   
           }
       );
   }
   
   
   function removePropertyLinks(propertyId) {
   
       const links =
           getCustomerPropertyLinks();
   
       const filtered =
           links.filter(function(link) {
   
               return String(
                   link.propertyId
               ) !== String(propertyId);
   
           });
   
       saveCustomerPropertyLinks(filtered);
   }
   
   
   /* =========================================================
      SETTINGS
   ========================================================= */
   
   function getSettings() {
   
       return getStorage(
           STORAGE_KEYS.settings,
           {}
       );
   }
   
   
   function saveSettings(settings) {
   
       return setStorage(
           STORAGE_KEYS.settings,
           settings
       );
   }
   
   
   /* =========================================================
      SEARCH PROPERTIES
   ========================================================= */
   
   function searchProperties(query) {
   
       const properties =
           getProperties();
   
       const text =
           String(query || "")
               .trim()
               .toLowerCase();
   
       if (!text) {
           return properties;
       }
   
       return properties.filter(
           function(property) {
   
               const searchable = [
   
                   property.code,
   
                   getPropertyRegion(property),
   
                   getPropertyNeighborhood(property),
   
                   getPropertyType(property),
   
                   getPropertyTransaction(property),
   
                   getPropertyArea(property),
   
                   getPropertyRooms(property),
   
                   getPropertyFloor(property),
   
                   getPropertyPrice(property),
   
                   getPropertyDeposit(property),
   
                   getPropertyRent(property),
   
                   property.createdBy
   
               ]
                   .map(function(value) {
                       return String(value || "")
                           .toLowerCase();
                   })
                   .join(" ");
   
               return searchable.includes(text);
           }
       );
   }
   
   
   /* =========================================================
      PROPERTY STATISTICS
   ========================================================= */
   
   function getPropertyStatistics() {
   
       const properties =
           getProperties();
   
       let sale = 0;
       let rent = 0;
       let mortgage = 0;
   
       properties.forEach(
           function(property) {
   
               const type =
                   String(
                       getPropertyTransaction(property)
                   );
   
               if (
                   type.includes("فروش")
               ) {
                   sale++;
               }
   
               if (
                   type.includes("اجاره")
               ) {
                   rent++;
               }
   
               if (
                   type.includes("رهن")
               ) {
                   mortgage++;
               }
   
           }
       );
   
       return {
   
           total:
               properties.length,
   
           sale:
               sale,
   
           rent:
               rent,
   
           mortgage:
               mortgage
   
       };
   }
   
   
   /* =========================================================
      EXPORT / IMPORT
   ========================================================= */
   
   function exportProperties() {
   
       const properties =
           getProperties();
   
       const data =
           JSON.stringify(
               properties,
               null,
               2
           );
   
       const blob =
           new Blob(
               [data],
               {
                   type:
                       "application/json"
               }
           );
   
       const url =
           URL.createObjectURL(blob);
   
       const link =
           document.createElement("a");
   
       link.href = url;
   
       link.download =
           "kolbeye-sabz-properties.json";
   
       document.body.appendChild(link);
   
       link.click();
   
       link.remove();
   
       URL.revokeObjectURL(url);
   }
   
   
   /* =========================================================
      GLOBAL ACCESS
   ========================================================= */
   
   window.STORAGE_KEYS = STORAGE_KEYS;
   
   window.getStorage = getStorage;
   window.setStorage = setStorage;
   window.removeStorage = removeStorage;
   
   window.escapeHTML = escapeHTML;
   
   window.normalizeNumber = normalizeNumber;
   window.formatNumber = formatNumber;
   window.formatMoney = formatMoney;
   
   window.getPersianDate = getPersianDate;
   window.getDateTime = getDateTime;
   
   window.getUsers = getUsers;
   window.saveUsers = saveUsers;
   window.getCurrentUser = getCurrentUser;
   window.getCurrentUserName = getCurrentUserName;
   window.logout = logout;
   
   window.getProperties = getProperties;
   window.saveProperties = saveProperties;
   
   window.generatePropertyId = generatePropertyId;
   window.generatePropertyCode = generatePropertyCode;
   
   window.getPropertyRegion = getPropertyRegion;
   window.getPropertyNeighborhood = getPropertyNeighborhood;
   window.getPropertyArea = getPropertyArea;
   window.getPropertyTransaction = getPropertyTransaction;
   window.getPropertyType = getPropertyType;
   window.getPropertyRooms = getPropertyRooms;
   window.getPropertyFloor = getPropertyFloor;
   window.getPropertyDirection = getPropertyDirection;
   window.getPropertyBuildYear = getPropertyBuildYear;
   window.getPropertyUnitsPerFloor = getPropertyUnitsPerFloor;
   window.getPropertyBuildingArea = getPropertyBuildingArea;
   window.getPropertyLandArea = getPropertyLandArea;
   window.getPropertyPrice = getPropertyPrice;
   window.getPropertyDeposit = getPropertyDeposit;
   window.getPropertyRent = getPropertyRent;
   
   window.getPropertyImages = getPropertyImages;
   
   window.FEATURE_NAMES = FEATURE_NAMES;
   window.getPropertyFeatures = getPropertyFeatures;
   window.getFeatureNames = getFeatureNames;
   
   window.normalizeProperty = normalizeProperty;
   
   window.addProperty = addProperty;
   window.updateProperty = updateProperty;
   window.deletePropertyById = deletePropertyById;
   window.findProperty = findProperty;
   
   window.setSelectedProperty = setSelectedProperty;
   window.getSelectedProperty = getSelectedProperty;
   
   window.setEditProperty = setEditProperty;
   window.getEditProperty = getEditProperty;
   
   window.getPriceHTML = getPriceHTML;
   
   window.getCustomers = getCustomers;
   window.saveCustomers = saveCustomers;
   window.addCustomer = addCustomer;
   window.findCustomer = findCustomer;
   window.updateCustomer = updateCustomer;
   window.deleteCustomer = deleteCustomer;
   
   window.getCustomerPropertyLinks =
       getCustomerPropertyLinks;
   
   window.saveCustomerPropertyLinks =
       saveCustomerPropertyLinks;
   
   window.linkCustomerToProperty =
       linkCustomerToProperty;
   
   window.unlinkCustomerFromProperty =
       unlinkCustomerFromProperty;
   
   window.getPropertiesForCustomer =
       getPropertiesForCustomer;
   
   window.getCustomersForProperty =
       getCustomersForProperty;
   
   window.removePropertyLinks =
       removePropertyLinks;
   
   window.getSettings = getSettings;
   window.saveSettings = saveSettings;
   
   window.searchProperties =
       searchProperties;
   
   window.getPropertyStatistics =
       getPropertyStatistics;
   
   window.exportProperties =
       exportProperties;
   
   
   /* =========================================================
      READY
   ========================================================= */
   
   console.log(
       "سامانه تخصصی املاک کلبه سبز - app.js loaded successfully"
   );
   "use strict";

/*==========================================
        سامانه املاک کلبه سبز V2
==========================================*/

let properties = [];
let filteredProperties = [];

/*=============================
        شروع برنامه
=============================*/

document.addEventListener("DOMContentLoaded", () => {

    loadProperties();

    bindEvents();

});

/*=============================
        دریافت فایل ها
=============================*/

async function loadProperties() {

    try {

        const response = await fetch("/api/properties");

        if (response.ok) {

            properties = await response.json();

        } else {

            properties = JSON.parse(
                localStorage.getItem("properties")
            ) || [];

        }

    } catch {

        properties = JSON.parse(
            localStorage.getItem("properties")
        ) || [];

    }

    filteredProperties = [...properties];

    updateStatistics();

    renderProperties();

}

/*=============================
        اتصال رویدادها
=============================*/

function bindEvents() {

    document
        .getElementById("searchInput")
        .addEventListener("input", filterProperties);

    document
        .getElementById("dealFilter")
        .addEventListener("change", filterProperties);

    document
        .getElementById("propertyFilter")
        .addEventListener("change", filterProperties);

    document
        .getElementById("sortBy")
        .addEventListener("change", sortProperties);

}

/*=============================
        آمار
=============================*/

function updateStatistics() {

    document.getElementById("totalProperties").textContent =
        properties.length;

    document.getElementById("saleCount").textContent =
        properties.filter(
            p => p.transactionType === "فروش"
        ).length;

    document.getElementById("rentCount").textContent =
        properties.filter(
            p => p.transactionType === "رهن و اجاره"
        ).length;

    document.getElementById("vipCount").textContent =
        properties.filter(
            p => p.vip
        ).length;

}