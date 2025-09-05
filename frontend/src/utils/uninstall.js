export async function uninstallApp(storageService, showIndicator) {
    console.log("Uninstalling application...");

    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
            console.log("Service Worker unregistered.");
        }
    }

    await storageService.deleteDatabase();
    console.log("IndexedDB database deleted.");

    showIndicator("Application data cleared. Reloading...", { duration: 2000 });
    setTimeout(() => {
        window.location.reload();
    }, 2000);
}