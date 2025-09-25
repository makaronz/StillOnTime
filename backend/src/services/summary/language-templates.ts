/**
 * Language Templates
 * Contains localized templates for summary generation
 */

// Polish language templates
export class PolishTemplates {
  sections = {
    header: "Plan Dnia Zdjęciowego",
    timeline: "Harmonogram",
    route: "Trasa i Czasy",
    weather: "Pogoda",
    warnings: "Ostrzeżenia",
    scenes: "Sceny",
    equipment: "Sprzęt",
    contacts: "Kontakty",
    safety: "Uwagi BHP",
    notes: "Dodatkowe Uwagi",
  };

  labels = {
    location: "Lokacja",
    date: "Data",
    callTime: "Call Time",
    sceneType: "Typ Sceny",
    totalTime: "Całkowity czas podróży",
    minutes: "minut",
    wakeUp: "Pobudka",
    departure: "Wyjazd",
    arrival: "Przyjazd",
  };

  timeline = {
    wakeUp: "Pobudka",
    wakeUpDesc: "Czas wstawać!",
    departure: "Wyjazd z domu",
    departureDesc: "Rozpoczęcie podróży",
    arrival: "Przyjazd na plan",
    arrivalDesc: "Dotarcie na lokację",
    callTime: "Call Time",
    callTimeDesc: "Rozpoczęcie pracy",
    wrap: "Przewidywany koniec",
    wrapDesc: "Zakończenie dnia zdjęciowego",
  };

  weather = {
    temperature: "Temperatura",
    wind: "Wiatr",
    precipitation: "Opady",
    humidity: "Wilgotność",
  };

  warnings = {
    earlyWakeUp:
      "Bardzo wczesna pobudka - przygotuj się na wcześniejsze położenie spać",
    longTravel: "Długa podróż - sprawdź trasę i warunki drogowe",
    coldWeather: "Zimna pogoda - ubierz się ciepło",
    hotWeather: "Gorąca pogoda - zabierz wodę i ochronę przeciwsłoneczną",
  };

  dateFormat = "pl";
}

// English language templates
export class EnglishTemplates {
  sections = {
    header: "Shooting Day Plan",
    timeline: "Timeline",
    route: "Route and Times",
    weather: "Weather",
    warnings: "Warnings",
    scenes: "Scenes",
    equipment: "Equipment",
    contacts: "Contacts",
    safety: "Safety Notes",
    notes: "Additional Notes",
  };

  labels = {
    location: "Location",
    date: "Date",
    callTime: "Call Time",
    sceneType: "Scene Type",
    totalTime: "Total travel time",
    minutes: "minutes",
    wakeUp: "Wake Up",
    departure: "Departure",
    arrival: "Arrival",
  };

  timeline = {
    wakeUp: "Wake Up",
    wakeUpDesc: "Time to get up!",
    departure: "Leave home",
    departureDesc: "Start journey",
    arrival: "Arrive on set",
    arrivalDesc: "Reach location",
    callTime: "Call Time",
    callTimeDesc: "Start work",
    wrap: "Estimated wrap",
    wrapDesc: "End of shooting day",
  };

  weather = {
    temperature: "Temperature",
    wind: "Wind",
    precipitation: "Precipitation",
    humidity: "Humidity",
  };

  warnings = {
    earlyWakeUp: "Very early wake up - prepare to go to bed earlier",
    longTravel: "Long journey - check route and road conditions",
    coldWeather: "Cold weather - dress warmly",
    hotWeather: "Hot weather - bring water and sun protection",
  };

  dateFormat = "en";
}
