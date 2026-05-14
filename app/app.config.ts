export default defineAppConfig({
    ui: {
        colors: {
            primary: 'emerald',
        },
        header: {
            slots: {
                center: 'hidden lg:flex flex-2',
                body: 'p-4 sm:p-6 overflow-y-auto h-full'
            }
        }
    },
})