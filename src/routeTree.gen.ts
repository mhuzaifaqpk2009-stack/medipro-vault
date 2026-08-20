/* eslint-disable */
// @ts-nocheck
// Generated route tree kept compact so newly added workspace routes are available immediately.
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AppRouteImport } from './routes/app'
import { Route as AppIndexRouteImport } from './routes/app.index'
import { Route as AppBillsRouteImport } from './routes/app.bills'
import { Route as AppCalculatorRouteImport } from './routes/app.calculator'
import { Route as AppCategoriesRouteImport } from './routes/app.categories'
import { Route as AppCustomersRouteImport } from './routes/app.customers'
import { Route as AppInventoryRouteImport } from './routes/app.inventory'
import { Route as AppMedicinesRouteImport } from './routes/app.medicines'
import { Route as AppOperationsRouteImport } from './routes/app.operations'
import { Route as AppPrescriptionsRouteImport } from './routes/app.prescriptions'
import { Route as AppPurchasesRouteImport } from './routes/app.purchases'
import { Route as AppReportsRouteImport } from './routes/app.reports'
import { Route as AppSalesRouteImport } from './routes/app.sales'
import { Route as AppSettingsRouteImport } from './routes/app.settings'
import { Route as AppShortcutsRouteImport } from './routes/app.shortcuts'
import { Route as AppSuppliersRouteImport } from './routes/app.suppliers'
import { Route as AppMessagesRouteImport } from './routes/app.messages'
import { Route as AppRacksRouteImport } from './routes/app.racks'
import { Route as AppWorkflowsRouteImport } from './routes/app.workflows'
import { Route as AppMacrosRouteImport } from './routes/app.macros'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const AppRoute = AppRouteImport.update({ id: '/app', path: '/app', getParentRoute: () => rootRouteImport } as any)
const child = (id: string, path: string, imported: any) => imported.update({ id, path, getParentRoute: () => AppRoute } as any)
const AppIndexRoute = child('/app/', '/', AppIndexRouteImport)
const AppBillsRoute = child('/app/bills', '/bills', AppBillsRouteImport)
const AppCalculatorRoute = child('/app/calculator', '/calculator', AppCalculatorRouteImport)
const AppCategoriesRoute = child('/app/categories', '/categories', AppCategoriesRouteImport)
const AppCustomersRoute = child('/app/customers', '/customers', AppCustomersRouteImport)
const AppInventoryRoute = child('/app/inventory', '/inventory', AppInventoryRouteImport)
const AppMedicinesRoute = child('/app/medicines', '/medicines', AppMedicinesRouteImport)
const AppOperationsRoute = child('/app/operations', '/operations', AppOperationsRouteImport)
const AppPrescriptionsRoute = child('/app/prescriptions', '/prescriptions', AppPrescriptionsRouteImport)
const AppPurchasesRoute = child('/app/purchases', '/purchases', AppPurchasesRouteImport)
const AppReportsRoute = child('/app/reports', '/reports', AppReportsRouteImport)
const AppSalesRoute = child('/app/sales', '/sales', AppSalesRouteImport)
const AppSettingsRoute = child('/app/settings', '/settings', AppSettingsRouteImport)
const AppShortcutsRoute = child('/app/shortcuts', '/shortcuts', AppShortcutsRouteImport)
const AppSuppliersRoute = child('/app/suppliers', '/suppliers', AppSuppliersRouteImport)
const AppMessagesRoute = child('/app/messages', '/messages', AppMessagesRouteImport)
const AppRacksRoute = child('/app/racks', '/racks', AppRacksRouteImport)
const AppWorkflowsRoute = child('/app/workflows', '/workflows', AppWorkflowsRouteImport)
const AppMacrosRoute = child('/app/macros', '/macros', AppMacrosRouteImport)

const AppRouteChildren = {
  AppIndexRoute, AppBillsRoute, AppCalculatorRoute, AppCategoriesRoute, AppCustomersRoute,
  AppInventoryRoute, AppMedicinesRoute, AppOperationsRoute, AppPrescriptionsRoute,
  AppPurchasesRoute, AppReportsRoute, AppSalesRoute, AppSettingsRoute, AppShortcutsRoute,
  AppSuppliersRoute, AppMessagesRoute, AppRacksRoute, AppWorkflowsRoute, AppMacrosRoute,
}
const AppRouteWithChildren = AppRoute._addFileChildren(AppRouteChildren)
export const routeTree = rootRouteImport._addFileChildren({ IndexRoute, AppRoute: AppRouteWithChildren })
