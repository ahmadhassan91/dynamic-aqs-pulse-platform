'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconActivity,
  IconDatabase,
  IconDashboard,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFileImport,
  IconKey,
  IconLink,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShield,
  IconUsers,
} from '@tabler/icons-react';
import type {
  AdminCalendarIntegrationSettingsResponse,
  AdminPaymentIntegrationSettingsResponse,
  AdminMicrosoftEntraIntegrationSettingsResponse,
  AdminLeadOperationalAlertDeliverySettingsResponse,
  AdminActivityEntry,
  AdminIntegrationStatusResponse,
  AdminOverviewResponse,
  AdminRoleAccessCatalogResponse,
  AdminUserStatus,
  AdminUserSummary,
  AffinityGroupReferenceSummary,
  BrandLabelReferenceSummary,
  AuthRole,
  CreateAdminUserRequest,
  ImportAdminUsersResponse,
  ListAdminUsersResponse,
  OwnershipGroupReferenceSummary,
  ReferenceValueSummary,
  UpdateAdminUserRequest,
} from '@pulse/contracts';
import {
  createAdminUser as createAdminUserRequest,
  deadLetterAdminLeadAlertDeliveries,
  fetchAdminCalendarIntegrationSettings,
  fetchAdminLeadAlertDeliverySettings,
  fetchAdminPaymentIntegrationSettings,
  fetchAdminMicrosoftEntraIntegrationSettings,
  fetchAdminIntegrations,
  fetchAdminActivity,
  fetchAdminOverview,
  fetchAdminRoleAccess,
  fetchAdminUsers,
  importAdminUsers as importAdminUsersRequest,
  resetAdminUserPassword,
  retryAdminLeadAlertDeliveries,
  updateAdminLeadAlertQuietHours,
  updateAdminLeadAlertRecipient,
  updateAdminCalendarIntegrationSettings as updateAdminCalendarIntegrationSettingsRequest,
  updateAdminPaymentIntegrationSettings as updateAdminPaymentIntegrationSettingsRequest,
  updateAdminMicrosoftEntraIntegrationSettings as updateAdminMicrosoftEntraIntegrationSettingsRequest,
  updateAdminUser as updateAdminUserRequest,
} from '@/lib/pulse-api';
import {
  fetchAdminAffinityGroups,
  fetchAdminBrandLabels,
  fetchAdminConsignmentAlertDeliverySettings,
  fetchAdminFeatureFlags,
  fetchAdminLeadSources,
  fetchAdminOwnershipGroups,
  fetchAdminRoutingThresholds,
  fetchAdminSystemSettings,
  type AdminConsignmentAlertDeliverySettingsResponse,
  type AdminFeatureFlagSummary,
  type AdminRoutingThresholdsResponse,
  type AdminSystemSettingsResponse,
} from '@/lib/pulse-api-ext-admin-consignment';
import {
  AUTH_ROLE_CATALOG,
  getRoleDisplayName,
} from '@/lib/auth-catalog';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import {
  EmptyStateMessage,
  WorkbenchAdvancedSection,
  WorkbenchHeader,
  WorkbenchMetricStrip,
  WorkbenchMoreMenu,
  WorkbenchTable,
} from '@/components/ui/Workbench';
import { AdminCalendarIntegrationPanel } from './AdminCalendarIntegrationPanel';
import { AdminEntraIntegrationPanel } from './AdminEntraIntegrationPanel';
import { AdminFeatureFlagsPanel } from './AdminFeatureFlagsPanel';
import { AdminLeadAlertDeliveryPanel } from './AdminLeadAlertDeliveryPanel';
import { AdminPaymentIntegrationPanel } from './AdminPaymentIntegrationPanel';
import { AdminReferenceDataPanel } from './AdminReferenceDataPanel';
import { AdminRoutingThresholdsPanel } from './AdminRoutingThresholdsPanel';
import { AdminSystemSettingsPanel } from './AdminSystemSettingsPanel';
import { ConsignmentAlertDeliveryPanel } from './ConsignmentAlertDeliveryPanel';
import { UserFormModal } from './UserFormModal';
import { UserImportModal } from './UserImportModal';

type AdminTab = 'overview' | 'users' | 'roles' | 'activity' | 'integrations' | 'configuration' | 'reference';
type AdminIntegrationProvider = 'entra' | 'calendar' | 'payments' | 'lead-alerts' | 'consignment-alerts';
type AdminConfigSection = 'routing' | 'system' | 'flags';
type AdminRoleAccessSummary = AdminRoleAccessCatalogResponse['roles'][number];

const authRoleCatalog = AUTH_ROLE_CATALOG ?? [];

const adminIntegrationProviderOptions: Array<{ value: AdminIntegrationProvider; label: string }> = [
  { value: 'entra', label: 'Microsoft Entra access' },
  { value: 'calendar', label: 'Outlook calendar' },
  { value: 'payments', label: 'Payment capture boundary' },
  { value: 'lead-alerts', label: 'Lead alerts' },
  { value: 'consignment-alerts', label: 'Consignment alerts' },
];

const adminConfigSectionOptions: Array<{ value: AdminConfigSection; label: string }> = [
  { value: 'routing', label: 'Routing thresholds & SLA timers' },
  { value: 'system', label: 'System settings' },
  { value: 'flags', label: 'Feature flags' },
];

export function AdminWorkspace({
  initialTab = 'users',
  initialIntegrationProvider = 'entra',
  initialConfigSection = 'routing',
}: {
  initialTab?: AdminTab;
  initialIntegrationProvider?: AdminIntegrationProvider;
  initialConfigSection?: AdminConfigSection;
}) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [rolesCatalog, setRolesCatalog] = useState<AdminRoleAccessCatalogResponse | null>(null);
  const [activity, setActivity] = useState<AdminActivityEntry[]>([]);
  const [integrationStatuses, setIntegrationStatuses] = useState<AdminIntegrationStatusResponse | null>(null);
  const [calendarIntegrationSettings, setCalendarIntegrationSettings] = useState<AdminCalendarIntegrationSettingsResponse | null>(null);
  const [paymentIntegrationSettings, setPaymentIntegrationSettings] = useState<AdminPaymentIntegrationSettingsResponse | null>(null);
  const [entraIntegrationSettings, setEntraIntegrationSettings] = useState<AdminMicrosoftEntraIntegrationSettingsResponse | null>(null);
  const [leadAlertDeliverySettings, setLeadAlertDeliverySettings] = useState<AdminLeadOperationalAlertDeliverySettingsResponse | null>(null);
  const [usersResponse, setUsersResponse] = useState<ListAdminUsersResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    page: 1,
    limit: 10,
  });
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userImportOpen, setUserImportOpen] = useState(false);
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [userImportLoading, setUserImportLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [selectedIntegrationProvider, setSelectedIntegrationProvider] = useState<AdminIntegrationProvider>(initialIntegrationProvider);
  const [selectedConfigSection, setSelectedConfigSection] = useState<AdminConfigSection>(initialConfigSection);
  const [userMutationError, setUserMutationError] = useState<string | null>(null);
  // UX-AD-007: Reference data
  const [affinityGroups, setAffinityGroups] = useState<AffinityGroupReferenceSummary[]>([]);
  const [ownershipGroups, setOwnershipGroups] = useState<OwnershipGroupReferenceSummary[]>([]);
  const [brandLabels, setBrandLabels] = useState<BrandLabelReferenceSummary[]>([]);
  const [leadSources, setLeadSources] = useState<ReferenceValueSummary[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  // UX-AD-008: Routing thresholds
  const [routingThresholds, setRoutingThresholds] = useState<AdminRoutingThresholdsResponse | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  // UX-AD-009: System settings
  const [systemSettings, setSystemSettings] = useState<AdminSystemSettingsResponse | null>(null);
  const [systemSettingsLoading, setSystemSettingsLoading] = useState(false);
  const [systemSettingsError, setSystemSettingsError] = useState<string | null>(null);
  // UX-AD-010: Feature flags
  const [featureFlags, setFeatureFlags] = useState<AdminFeatureFlagSummary[]>([]);
  const [featureFlagsLoading, setFeatureFlagsLoading] = useState(false);
  const [featureFlagsError, setFeatureFlagsError] = useState<string | null>(null);
  // UX-CSG-008: Consignment alert delivery settings
  const [consignmentAlertSettings, setConsignmentAlertSettings] = useState<AdminConsignmentAlertDeliverySettingsResponse | null>(null);
  // UX-AD-001: confirmation state before deactivation
  const [pendingDeactivateUser, setPendingDeactivateUser] = useState<AdminUserSummary | null>(null);
  const role = auth?.identity.role;
  const tabAccess = useMemo(
    () => ({
      overview: role ? canPerformAction(role, 'admin.user_view') : false,
      users: role ? canPerformAction(role, 'admin.user_view') : false,
      roles: role ? canPerformAction(role, 'admin.role_view') : false,
      activity: role ? canPerformAction(role, 'admin.audit_view') : false,
      integrations: role ? canPerformAction(role, 'admin.integration_view') : false,
      configuration: role ? canPerformAction(role, 'admin.integration_manage') : false,
      reference: role ? canPerformAction(role, 'reference.view') : false,
    }),
    [role],
  );
  const canManageIntegrations = role ? canPerformAction(role, 'admin.integration_manage') : false;
  const canManageBusinessRules = role ? canPerformAction(role, 'product.manage') : false;
  const canManageReference = role ? canPerformAction(role, 'reference.manage') : false;
  const availableTabs = useMemo(
    () => (['users', 'roles', 'overview', 'activity', 'integrations', 'configuration', 'reference'] as const).filter((tab) => tabAccess[tab]),
    [tabAccess],
  );

  useEffect(() => {
    if (!availableTabs.length) {
      return;
    }

    setActiveTab(availableTabs.includes(initialTab) ? initialTab : (availableTabs[0] ?? 'overview'));
  }, [availableTabs, initialTab]);

  useEffect(() => {
    setSelectedIntegrationProvider(initialIntegrationProvider);
  }, [initialIntegrationProvider]);

  useEffect(() => {
    setSelectedConfigSection(initialConfigSection);
  }, [initialConfigSection]);

  useEffect(() => {
    const accessToken = auth?.tokens.accessToken;
    if (!accessToken || !tabAccess.overview) {
      return;
    }
    const token = accessToken;

    let cancelled = false;
    setOverviewLoading(true);

    async function loadOverview() {
      try {
        const nextOverview = await fetchAdminOverview(apiBaseUrl, token);

        if (cancelled) {
          return;
        }

        setOverview(nextOverview);
        setOverviewError(null);
      } catch (error) {
        if (!cancelled) {
          setOverviewError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, tabAccess.overview]);

  useEffect(() => {
    const accessToken = auth?.tokens.accessToken;
    if (!accessToken || !tabAccess.roles) {
      return;
    }
    const token = accessToken;

    let cancelled = false;
    setRolesLoading(true);

    async function loadRoles() {
      try {
        const nextRoles = await fetchAdminRoleAccess(apiBaseUrl, token);

        if (cancelled) {
          return;
        }

        setRolesCatalog(nextRoles);
        setRolesError(null);
      } catch (error) {
        if (!cancelled) {
          setRolesError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setRolesLoading(false);
        }
      }
    }

    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, tabAccess.roles]);

  useEffect(() => {
    const accessToken = auth?.tokens.accessToken;
    if (!accessToken || !tabAccess.activity) {
      return;
    }
    const token = accessToken;

    let cancelled = false;
    setActivityLoading(true);

    async function loadActivity() {
      try {
        const nextActivity = await fetchAdminActivity(apiBaseUrl, token, { limit: 12 });

        if (cancelled) {
          return;
        }

        setActivity(nextActivity.entries);
        setActivityError(null);
      } catch (error) {
        if (!cancelled) {
          setActivityError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, tabAccess.activity]);

  useEffect(() => {
    const accessToken = auth?.tokens.accessToken;
    if (!accessToken || !tabAccess.integrations) {
      return;
    }
    const token = accessToken;

    let cancelled = false;
    setIntegrationsLoading(true);

    async function loadIntegrations() {
      try {
        const [statusResponse, calendarSettingsResponse, paymentSettingsResponse, entraSettingsResponse, leadAlertSettingsResponse, consignmentAlertSettingsResponse] = await Promise.all([
          fetchAdminIntegrations(apiBaseUrl, token),
          fetchAdminCalendarIntegrationSettings(apiBaseUrl, token),
          fetchAdminPaymentIntegrationSettings(apiBaseUrl, token),
          fetchAdminMicrosoftEntraIntegrationSettings(apiBaseUrl, token),
          fetchAdminLeadAlertDeliverySettings(apiBaseUrl, token),
          fetchAdminConsignmentAlertDeliverySettings(apiBaseUrl, token),
        ]);

        if (cancelled) {
          return;
        }

        setIntegrationStatuses(statusResponse);
        setCalendarIntegrationSettings(calendarSettingsResponse);
        setPaymentIntegrationSettings(paymentSettingsResponse);
        setEntraIntegrationSettings(entraSettingsResponse);
        setLeadAlertDeliverySettings(leadAlertSettingsResponse);
        setConsignmentAlertSettings(consignmentAlertSettingsResponse);
        setIntegrationsError(null);
      } catch (error) {
        if (!cancelled) {
          setIntegrationsError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIntegrationsLoading(false);
        }
      }
    }

    void loadIntegrations();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, tabAccess.integrations]);

  // UX-AD-007: load reference data when the reference tab is active
  useEffect(() => {
    const accessToken = auth?.tokens.accessToken;
    if (!accessToken || !tabAccess.reference) {
      return;
    }
    const token = accessToken;
    let cancelled = false;
    setReferenceLoading(true);

    async function loadReference() {
      try {
        const [affinityResponse, ownershipResponse, brandResponse, sourceResponse] = await Promise.all([
          fetchAdminAffinityGroups(apiBaseUrl, token),
          fetchAdminOwnershipGroups(apiBaseUrl, token),
          fetchAdminBrandLabels(apiBaseUrl, token),
          fetchAdminLeadSources(apiBaseUrl, token),
        ]);
        if (!cancelled) {
          setAffinityGroups(affinityResponse.items);
          setOwnershipGroups(ownershipResponse.items);
          setBrandLabels(brandResponse.items);
          setLeadSources(sourceResponse.items);
          setReferenceError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setReferenceError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setReferenceLoading(false);
        }
      }
    }

    void loadReference();
    return () => { cancelled = true; };
  }, [apiBaseUrl, auth, tabAccess.reference]);

  // UX-AD-008/009/010: load configuration data when the configuration tab is active
  useEffect(() => {
    const accessToken = auth?.tokens.accessToken;
    if (!accessToken || !tabAccess.configuration) {
      return;
    }
    const token = accessToken;
    let cancelled = false;

    async function loadConfiguration() {
      setRoutingLoading(true);
      setSystemSettingsLoading(true);
      setFeatureFlagsLoading(true);

      try {
        const [routingResponse, systemResponse, flagsResponse] = await Promise.all([
          fetchAdminRoutingThresholds(apiBaseUrl, token),
          fetchAdminSystemSettings(apiBaseUrl, token),
          fetchAdminFeatureFlags(apiBaseUrl, token),
        ]);
        if (!cancelled) {
          setRoutingThresholds(routingResponse);
          setSystemSettings(systemResponse);
          setFeatureFlags(flagsResponse.flags);
          setRoutingError(null);
          setSystemSettingsError(null);
          setFeatureFlagsError(null);
        }
      } catch (error) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : String(error);
          setRoutingError(msg);
          setSystemSettingsError(msg);
          setFeatureFlagsError(msg);
        }
      } finally {
        if (!cancelled) {
          setRoutingLoading(false);
          setSystemSettingsLoading(false);
          setFeatureFlagsLoading(false);
        }
      }
    }

    void loadConfiguration();
    return () => { cancelled = true; };
  }, [apiBaseUrl, auth, tabAccess.configuration]);

  useEffect(() => {
    const accessToken = auth?.tokens.accessToken;
    if (!accessToken || !tabAccess.users) {
      return;
    }
    const token = accessToken;

    let cancelled = false;
    setUsersLoading(true);

    async function loadUsers() {
      try {
        const response = await fetchAdminUsers(apiBaseUrl, token, {
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.role ? { role: filters.role as AuthRole } : {}),
          ...(filters.status ? { status: filters.status as AdminUserStatus } : {}),
          page: filters.page,
          limit: filters.limit,
        });

        if (!cancelled) {
          setUsersResponse(response);
          setUserError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setUserError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, filters, tabAccess.users]);

  const users = usersResponse?.users ?? [];
  const totalPages = usersResponse ? Math.max(1, Math.ceil(usersResponse.total / usersResponse.limit)) : 1;
  const hasActiveUserFilters = Boolean(filters.search || filters.role || filters.status);

  const roleOptions = useMemo(
    () => authRoleCatalog.map((entry) => ({ value: entry, label: getRoleDisplayName(entry) })),
    [],
  );

  async function refreshWorkspace() {
    if (!auth) {
      return;
    }

    const jobs: Promise<void>[] = [];

    if (tabAccess.overview) {
      jobs.push(
        fetchAdminOverview(apiBaseUrl, auth.tokens.accessToken).then((nextOverview) => {
          setOverview(nextOverview);
          setOverviewError(null);
        }),
      );
    }

    if (tabAccess.roles) {
      jobs.push(
        fetchAdminRoleAccess(apiBaseUrl, auth.tokens.accessToken).then((nextRoles) => {
          setRolesCatalog(nextRoles);
          setRolesError(null);
        }),
      );
    }

    if (tabAccess.activity) {
      jobs.push(
        fetchAdminActivity(apiBaseUrl, auth.tokens.accessToken, { limit: 12 }).then((nextActivity) => {
          setActivity(nextActivity.entries);
          setActivityError(null);
        }),
      );
    }

    if (tabAccess.integrations) {
      jobs.push(
        Promise.all([
          fetchAdminIntegrations(apiBaseUrl, auth.tokens.accessToken),
          fetchAdminCalendarIntegrationSettings(apiBaseUrl, auth.tokens.accessToken),
          fetchAdminPaymentIntegrationSettings(apiBaseUrl, auth.tokens.accessToken),
          fetchAdminMicrosoftEntraIntegrationSettings(apiBaseUrl, auth.tokens.accessToken),
          fetchAdminLeadAlertDeliverySettings(apiBaseUrl, auth.tokens.accessToken),
          fetchAdminConsignmentAlertDeliverySettings(apiBaseUrl, auth.tokens.accessToken),
        ]).then(([statusResponse, calendarSettingsResponse, paymentSettingsResponse, entraSettingsResponse, leadAlertSettingsResponse, consignmentAlertSettingsResponse]) => {
          setIntegrationStatuses(statusResponse);
          setCalendarIntegrationSettings(calendarSettingsResponse);
          setPaymentIntegrationSettings(paymentSettingsResponse);
          setEntraIntegrationSettings(entraSettingsResponse);
          setLeadAlertDeliverySettings(leadAlertSettingsResponse);
          setConsignmentAlertSettings(consignmentAlertSettingsResponse);
          setIntegrationsError(null);
        }),
      );
    }

    await Promise.all(jobs);
  }

  async function refreshUsers() {
    if (!auth || !tabAccess.users) {
      return;
    }

    const response = await fetchAdminUsers(apiBaseUrl, auth.tokens.accessToken, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.role ? { role: filters.role as AuthRole } : {}),
      ...(filters.status ? { status: filters.status as AdminUserStatus } : {}),
      page: filters.page,
      limit: filters.limit,
    });
    setUsersResponse(response);
  }

  async function handleUserSave(values: {
    email: string;
    firstName: string;
    lastName: string;
    role: AuthRole;
    actorType: 'internal' | 'dealer';
    isActive: boolean;
    password: string;
  }) {
    if (!auth) {
      return;
    }

    setUserFormLoading(true);
    setUserMutationError(null);

    try {
      if (selectedUser) {
        const updatePayload: UpdateAdminUserRequest = {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role,
          isActive: values.isActive,
        };
        await updateAdminUserRequest(apiBaseUrl, auth.tokens.accessToken, selectedUser.id, updatePayload);
        notifications.show({ color: 'green', message: 'User updated successfully.' });
      } else {
        // UX-AD-011: include actorType so dealer-portal users can be created
        const createPayload: CreateAdminUserRequest = {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role,
          isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
          ...(values.actorType === 'dealer' ? { actorType: 'dealer' as const } : {}),
        };
        const created = await createAdminUserRequest(apiBaseUrl, auth.tokens.accessToken, createPayload);
        notifications.show({
          color: 'green',
          message: `User created. Temporary password: ${created.temporaryPassword}`,
          autoClose: 9000,
        });
      }

      setUserFormOpen(false);
      setSelectedUser(null);
      await Promise.all([refreshUsers(), refreshWorkspace()]);
    } catch (error) {
      setUserMutationError(error instanceof Error ? error.message : String(error));
    } finally {
      setUserFormLoading(false);
    }
  }

  async function handleUserImport(rows: CreateAdminUserRequest[]) {
    if (!auth) {
      throw new Error('You must be signed in to import users.');
    }

    setUserImportLoading(true);
    setUserMutationError(null);

    try {
      const response: ImportAdminUsersResponse = await importAdminUsersRequest(apiBaseUrl, auth.tokens.accessToken, {
        rows,
      });
      await Promise.all([refreshUsers(), refreshWorkspace()]);
      notifications.show({
        color: response.failed > 0 ? 'yellow' : 'green',
        message: `Imported ${response.successful} of ${response.totalProcessed} users.`,
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUserMutationError(message);
      throw error;
    } finally {
      setUserImportLoading(false);
    }
  }

  async function handleResetPassword(user: AdminUserSummary) {
    if (!auth) {
      return;
    }

    try {
      const response = await resetAdminUserPassword(apiBaseUrl, auth.tokens.accessToken, user.id);
      notifications.show({
        color: 'green',
        message: `Password reset for ${user.email}. Temporary password: ${response.temporaryPassword}`,
        autoClose: 9000,
      });
      await refreshWorkspace();
      await refreshUsers();
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleToggleActive(user: AdminUserSummary) {
    if (!auth) {
      return;
    }

    try {
      await updateAdminUserRequest(apiBaseUrl, auth.tokens.accessToken, user.id, {
        isActive: !user.isActive,
      });
      notifications.show({
        color: 'green',
        message: `${user.isActive ? 'Deactivated' : 'Activated'} ${user.email}.`,
      });
      await Promise.all([refreshUsers(), refreshWorkspace()]);
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleIntegrationSave(values: {
    allowUserConnections: boolean;
    sharedCalendarsEnabled: boolean;
    defaultMeetingProvider: 'none' | 'teams';
    autoSyncDiscoveryEnabled: boolean;
    autoSyncTrainingEnabled: boolean;
    pilotUserEmails: string[];
  }) {
    if (!auth) {
      return;
    }

    setIntegrationSaving(true);
    try {
      const response = await updateAdminCalendarIntegrationSettingsRequest(apiBaseUrl, auth.tokens.accessToken, values);
      setCalendarIntegrationSettings(response);
      const nextStatuses = await fetchAdminIntegrations(apiBaseUrl, auth.tokens.accessToken);
      setIntegrationStatuses(nextStatuses);
      setIntegrationsError(null);
      notifications.show({
        color: 'green',
        message: 'Calendar integration settings updated.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleEntraIntegrationSave(values: {
    allowEmailLinking: boolean;
    autoProvisionFromGroups: boolean;
    allowedDomains: string[];
    groupRoleMappings: Array<{ groupId: string; role: AuthRole }>;
  }) {
    if (!auth) {
      return;
    }

    setIntegrationSaving(true);
    try {
      const response = await updateAdminMicrosoftEntraIntegrationSettingsRequest(apiBaseUrl, auth.tokens.accessToken, values);
      setEntraIntegrationSettings(response);
      const nextStatuses = await fetchAdminIntegrations(apiBaseUrl, auth.tokens.accessToken);
      setIntegrationStatuses(nextStatuses);
      setIntegrationsError(null);
      notifications.show({
        color: 'green',
        message: 'Microsoft Entra access settings updated.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handlePaymentIntegrationSave(values: {
    captureMode: 'manual_recording' | 'provider_runtime';
    defaultProvider: 'unknown' | 'ebizcharge' | 'moneris';
    allowCisCaptureTracking: boolean;
    allowAccountPaymentMethodManagement: boolean;
  }) {
    if (!auth) {
      return;
    }

    setIntegrationSaving(true);
    try {
      const response = await updateAdminPaymentIntegrationSettingsRequest(apiBaseUrl, auth.tokens.accessToken, values);
      setPaymentIntegrationSettings(response);
      const nextStatuses = await fetchAdminIntegrations(apiBaseUrl, auth.tokens.accessToken);
      setIntegrationStatuses(nextStatuses);
      setIntegrationsError(null);
      notifications.show({
        color: 'green',
        message: 'Payment integration settings updated.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function refreshLeadAlertDeliveryIntegration() {
    if (!auth) {
      return;
    }

    const [statusResponse, leadAlertSettingsResponse] = await Promise.all([
      fetchAdminIntegrations(apiBaseUrl, auth.tokens.accessToken),
      fetchAdminLeadAlertDeliverySettings(apiBaseUrl, auth.tokens.accessToken),
    ]);
    setIntegrationStatuses(statusResponse);
    setLeadAlertDeliverySettings(leadAlertSettingsResponse);
    setIntegrationsError(null);
  }

  async function handleLeadAlertRetry() {
    if (!auth) {
      return;
    }

    setIntegrationSaving(true);
    try {
      const result = await retryAdminLeadAlertDeliveries(apiBaseUrl, auth.tokens.accessToken, {
        limit: 50,
      });
      await refreshLeadAlertDeliveryIntegration();
      notifications.show({
        color: 'green',
        message: `Requeued ${result.retriedAlertCount} lead alert delivery attempt(s).`,
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleLeadAlertDeadLetter(reason: string) {
    if (!auth || !leadAlertDeliverySettings?.metrics.latestFailure) {
      return;
    }

    setIntegrationSaving(true);
    try {
      const result = await deadLetterAdminLeadAlertDeliveries(apiBaseUrl, auth.tokens.accessToken, {
        alertIds: [leadAlertDeliverySettings.metrics.latestFailure.alertId],
        reason,
      });
      await refreshLeadAlertDeliveryIntegration();
      notifications.show({
        color: 'green',
        message: `Marked ${result.deadLetteredAlertCount} lead alert delivery attempt(s) as skipped.`,
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleLeadAlertQuietHoursChange(input: {
    enabled?: boolean;
    startLocal?: string;
    endLocal?: string;
    timeZone?: string;
  }) {
    if (!auth) {
      return;
    }

    setIntegrationSaving(true);
    try {
      const response = await updateAdminLeadAlertQuietHours(apiBaseUrl, auth.tokens.accessToken, input);
      setLeadAlertDeliverySettings(response);
      const nextStatuses = await fetchAdminIntegrations(apiBaseUrl, auth.tokens.accessToken);
      setIntegrationStatuses(nextStatuses);
      notifications.show({
        color: 'green',
        message: 'Lead alert quiet-hours policy updated.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleLeadAlertRecipientChange(
    recipientId: string,
    input: { name?: string; email?: string | null; roleTitle?: string | null; isActive?: boolean; sortOrder?: number },
  ) {
    if (!auth) {
      return;
    }

    setIntegrationSaving(true);
    try {
      const response = await updateAdminLeadAlertRecipient(apiBaseUrl, auth.tokens.accessToken, recipientId, input);
      setLeadAlertDeliverySettings(response);
      const nextStatuses = await fetchAdminIntegrations(apiBaseUrl, auth.tokens.accessToken);
      setIntegrationStatuses(nextStatuses);
      notifications.show({
        color: 'green',
        message: 'Lead alert recipient updated.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleExportUsersCsv() {
    if (!auth) {
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetchAdminUsers(apiBaseUrl, auth.tokens.accessToken, {
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.role ? { role: filters.role as AdminUserSummary['role'] } : {}),
        ...(filters.status ? { status: filters.status as AdminUserSummary['status'] } : {}),
        limit: 1000,
      });

      const header = ['Name', 'Email', 'Role', 'Actor Type', 'Provider', 'Status', 'Active Sessions', 'Last Login', 'Created At'].join(',');
      const rows = response.users.map((user) => [
        JSON.stringify(user.displayName),
        JSON.stringify(user.email),
        JSON.stringify(user.role),
        JSON.stringify(user.actorType),
        JSON.stringify(user.provider),
        JSON.stringify(user.status),
        String(user.activeSessionCount),
        user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : '',
        new Date(user.createdAt).toISOString(),
      ].join(','));

      const csv = [header, ...rows].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Export failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsExporting(false);
    }
  }

  // UX-AD-012: client-side CSV export of already-fetched audit rows
  async function handleExportAuditCsv() {
    if (activity.length === 0) {
      notifications.show({ color: 'yellow', message: 'No audit rows to export. Load the Audit Monitor tab first.' });
      return;
    }

    try {
      const header = ['User', 'Action', 'Entity Type', 'Entity ID', 'Timestamp', 'Summary'].join(',');
      const rows = activity.map((entry) => [
        JSON.stringify(entry.actor?.displayName ?? 'System'),
        JSON.stringify(entry.action),
        JSON.stringify(entry.entityType),
        JSON.stringify(entry.entityId ?? ''),
        new Date(entry.createdAt).toISOString(),
        JSON.stringify(entry.summary ?? ''),
      ].join(','));

      const csv = [header, ...rows].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Export failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const currentTabLoading = (
    !isHydrated
    || (activeTab === 'overview' && tabAccess.overview && (overviewLoading || !overview))
    || (activeTab === 'users' && tabAccess.users && (usersLoading || !usersResponse))
    || (activeTab === 'roles' && tabAccess.roles && (rolesLoading || !rolesCatalog))
    || (activeTab === 'activity' && tabAccess.activity && activityLoading && activity.length === 0)
    || (activeTab === 'integrations' && tabAccess.integrations && (integrationsLoading || !integrationStatuses || !calendarIntegrationSettings || !paymentIntegrationSettings || !entraIntegrationSettings || !leadAlertDeliverySettings))
    || (activeTab === 'reference' && tabAccess.reference && referenceLoading && affinityGroups.length === 0 && ownershipGroups.length === 0)
    || (activeTab === 'configuration' && tabAccess.configuration && routingLoading && !routingThresholds)
  );

  const currentTabError = (
    activeTab === 'overview' ? overviewError
    : activeTab === 'users' ? userError
    : activeTab === 'roles' ? rolesError
    : activeTab === 'integrations' ? integrationsError
    : activeTab === 'reference' ? referenceError
    : activeTab === 'configuration' ? routingError
    : activityError
  );

  if (!isHydrated || currentTabLoading || availableTabs.length === 0) {
    return (
      <Paper shadow="sm" p="xl">
        <Group justify="center">
          <Loader color="blue" />
          <Text>Loading administration workspace...</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <>
      <Stack gap="md">
        <WorkbenchHeader
          eyebrow="Admin"
          title="System Administration"
          description="Manage users and access first. Setup, integrations, audit evidence, and business rules stay one layer deeper."
          policyText="Role access, setup changes, and user mutations remain permission-gated and audit-backed."
          primaryAction={tabAccess.users && activeTab === 'users' ? (
            <Group gap="sm">
              <Button leftSection={<IconPlus size={16} />} onClick={() => {
                setSelectedUser(null);
                setUserMutationError(null);
                setUserFormOpen(true);
                setActiveTab('users');
              }}>
                Add User
              </Button>
              <Menu position="bottom-end" shadow="md" width={200}>
                <Menu.Target>
                  <Button variant="default" px="xs" aria-label="More user actions">
                    <IconDotsVertical size={16} />
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconFileImport size={16} />}
                    onClick={() => {
                      setUserMutationError(null);
                      setUserImportOpen(true);
                      setActiveTab('users');
                    }}
                  >
                    Import Users
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          ) : null}
        />

        {currentTabError ? (
          <Alert color="red">{currentTabError}</Alert>
        ) : null}

        <Tabs value={activeTab} onChange={(value) => setActiveTab((value as AdminTab) || 'users')} keepMounted={false}>
          <Tabs.List>
            {tabAccess.users ? (
              <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
                Users & Access
              </Tabs.Tab>
            ) : null}
            {tabAccess.roles ? (
              <Tabs.Tab value="roles" leftSection={<IconShield size={16} />}>
                Access Profiles
              </Tabs.Tab>
            ) : null}
            {tabAccess.overview ? (
              <Tabs.Tab value="overview" leftSection={<IconDashboard size={16} />}>
                System Setup
              </Tabs.Tab>
            ) : null}
            {tabAccess.activity ? (
              <Tabs.Tab value="activity" leftSection={<IconActivity size={16} />}>
                Audit Monitor
              </Tabs.Tab>
            ) : null}
            {tabAccess.integrations ? (
              <Tabs.Tab value="integrations" leftSection={<IconLink size={16} />}>
                Integrations
              </Tabs.Tab>
            ) : null}
            {tabAccess.configuration ? (
              <Tabs.Tab value="configuration" leftSection={<IconSettings size={16} />}>
                Configuration
              </Tabs.Tab>
            ) : null}
            {tabAccess.reference ? (
              <Tabs.Tab value="reference" leftSection={<IconDatabase size={16} />}>
                Reference Data
              </Tabs.Tab>
            ) : null}
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Stack gap="md">
              <WorkbenchMetricStrip
                metrics={[
                  { label: 'Active Users', value: String(overview?.activeUsers ?? 0), tone: 'blue' },
                  { label: 'Pending Users', value: String(overview?.pendingUsers ?? 0), tone: (overview?.pendingUsers ?? 0) > 0 ? 'yellow' : 'green' },
                  { label: 'Live Sessions', value: String(overview?.activeSessions ?? 0), tone: 'green' },
                  { label: 'Access Profiles', value: String(rolesCatalog?.roles.length ?? authRoleCatalog.length), tone: 'violet' },
                ]}
              />

              <Paper shadow="sm" p="md">
                <Title order={3} mb="md">Daily Admin Work</Title>
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                  {tabAccess.users ? (
                    <ActionCard
                      icon={IconUsers}
                      title="Users & Access"
                      description="Add, import, deactivate, or reset users."
                      onClick={() => setActiveTab('users')}
                    />
                  ) : null}
                  {tabAccess.roles ? (
                    <ActionCard
                      icon={IconShield}
                      title="Access Profiles"
                      description="Review role scopes and boundaries."
                      onClick={() => setActiveTab('roles')}
                    />
                  ) : null}
                </SimpleGrid>
              </Paper>

              <Paper shadow="sm" p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Title order={3}>Setup and Evidence</Title>
                    <Text size="sm" c="dimmed">
                      Configuration, integrations, and audit evidence stay one layer down from the daily user queue.
                    </Text>
                  </Stack>
                  <WorkbenchMoreMenu
                    label="Open setup"
                    items={[
                      ...(canManageBusinessRules ? [{
                        id: 'business-rules',
                        label: 'Business Rules',
                        description: 'Manage dealer catalog rules.',
                        icon: <IconShield size={16} />,
                        onClick: () => {
                          router.push('/admin/catalog-rules');
                        },
                      }] : []),
                      ...(tabAccess.activity ? [{
                        id: 'audit-monitor',
                        label: 'Audit Monitor',
                        description: 'Review admin and auth events.',
                        icon: <IconActivity size={16} />,
                        onClick: () => setActiveTab('activity'),
                      }] : []),
                      ...(tabAccess.integrations ? [{
                        id: 'integrations',
                        label: 'Integrations',
                        description: 'Review Outlook, Entra, payment, and alerts.',
                        icon: <IconLink size={16} />,
                        onClick: () => setActiveTab('integrations'),
                      }] : []),
                    ]}
                  />
                </Group>
              </Paper>

            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="users" pt="md">
            <Stack gap="md">
              <Paper shadow="sm" p="md">
                <Group grow align="flex-end">
                  <TextInput
                    placeholder="Search users..."
                    value={filters.search}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setFilters((current) => ({ ...current, search: nextValue, page: 1 }));
                    }}
                    leftSection={<IconSearch size={16} />}
                  />
                  <Select
                    placeholder="All Roles"
                    value={filters.role}
                    onChange={(value) => setFilters((current) => ({ ...current, role: value || '', page: 1 }))}
                    data={[{ value: '', label: 'All Roles' }, ...roleOptions]}
                  />
                  <Select
                    placeholder="All Statuses"
                    value={filters.status}
                    onChange={(value) => setFilters((current) => ({ ...current, status: value || '', page: 1 }))}
                    data={[
                      { value: '', label: 'All Statuses' },
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'PENDING', label: 'Pending' },
                      { value: 'INACTIVE', label: 'Inactive' },
                    ]}
                  />
                  {hasActiveUserFilters ? (
                    <Button
                      variant="light"
                      onClick={() => setFilters({
                        search: '',
                        role: '',
                        status: '',
                        page: 1,
                        limit: 10,
                      })}
                    >
                      Clear Filters
                    </Button>
                  ) : null}
                </Group>
              </Paper>

              <Paper shadow="sm">
                <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                  <Group gap="sm">
                    <Title order={3}>Users ({usersResponse?.total ?? 0})</Title>
                    {usersLoading ? <Loader size="sm" /> : null}
                  </Group>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    loading={isExporting}
                    onClick={() => void handleExportUsersCsv()}
                  >
                    Export CSV
                  </Button>
                </Group>

                <WorkbenchTable<AdminUserSummary>
                  ariaLabel="Admin users"
                  rows={users}
                  getRowKey={(user) => user.id}
                  minWidth={820}
                  withContainer={false}
                  columns={[
                    {
                      key: 'user',
                      header: 'User',
                      render: (user) => (
                        <Stack gap={0}>
                          <Text fw={500} size="sm">{user.displayName}</Text>
                          <Text c="dimmed" size="xs">{user.email}</Text>
                        </Stack>
                      ),
                    },
                    {
                      key: 'access',
                      header: 'Access',
                      render: (user) => (
                        <Stack gap={4}>
                          <Text size="sm" fw={500}>{getRoleDisplayName(user.role)}</Text>
                          <Group gap="xs">
                            <Badge color={statusColor(user.status)} variant="light">
                              {user.status}
                            </Badge>
                          </Group>
                        </Stack>
                      ),
                    },
                    {
                      key: 'sessions',
                      header: 'Sessions',
                      render: (user) => user.activeSessionCount,
                      align: 'right',
                    },
                    {
                      key: 'last-login',
                      header: 'Last login',
                      render: (user) => (
                        <Text size="sm" c="dimmed">
                          {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                        </Text>
                      ),
                    },
                  ]}
                  rowActions={(user) => [
                    {
                      id: 'edit-user',
                      label: 'Edit user',
                      icon: <IconEdit size={16} />,
                      onClick: () => {
                        setSelectedUser(user);
                        setUserMutationError(null);
                        setUserFormOpen(true);
                      },
                    },
                    {
                      id: 'reset-password',
                      label: 'Reset password',
                      icon: <IconKey size={16} />,
                      onClick: () => {
                        void handleResetPassword(user);
                      },
                    },
                    {
                      id: user.isActive ? 'deactivate-user' : 'activate-user',
                      label: user.isActive ? 'Deactivate user' : 'Activate user',
                      color: user.isActive ? 'yellow' : 'green',
                      onClick: () => {
                        if (user.isActive) {
                          // UX-AD-001: show confirmation before deactivating
                          setPendingDeactivateUser(user);
                        } else {
                          void handleToggleActive(user);
                        }
                      },
                    },
                  ]}
                  emptyState={(
                    <EmptyStateMessage
                      kind="filtered-out"
                      title="No users match the current filters"
                      description="Clear filters or adjust the search to find a user."
                    />
                  )}
                />

                <Group justify="space-between" p="md">
                  <Text size="sm" c="dimmed">
                    Showing {users.length === 0 ? 0 : ((filters.page - 1) * filters.limit) + 1}
                    {' '}to {Math.min(filters.page * filters.limit, usersResponse?.total ?? 0)}
                    {' '}of {usersResponse?.total ?? 0} users
                  </Text>
                  <Pagination
                    value={filters.page}
                    onChange={(page) => setFilters((current) => ({ ...current, page }))}
                    total={totalPages}
                    size="sm"
                  />
                </Group>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="roles" pt="md">
            <Stack gap="md">
              <Alert color="blue" variant="light">
                Use these as ready-made access profiles, not a complex permission matrix. Most teams should assign one
                clear profile per user and keep special exceptions rare.
              </Alert>

              <WorkbenchTable<AdminRoleAccessSummary>
                ariaLabel="Admin access profiles"
                rows={rolesCatalog?.roles ?? []}
                getRowKey={(roleSummary) => roleSummary.role}
                minWidth={980}
                columns={[
                  {
                    key: 'profile',
                    header: 'Profile',
                    render: (roleSummary) => (
                      <Stack gap={2}>
                        <Text fw={700}>{roleSummary.displayName}</Text>
                        <Text size="xs" c="dimmed">{roleSummary.summary}</Text>
                      </Stack>
                    ),
                  },
                  {
                    key: 'best-for',
                    header: 'Best for',
                    render: (roleSummary) => <Text size="sm">{roleSummary.bestFor}</Text>,
                  },
                  {
                    key: 'workspaces',
                    header: 'Everyday work',
                    render: (roleSummary) => (
                      <Group gap={4}>
                        {roleSummary.workspaceHighlights.slice(0, 4).map((module) => (
                          <Badge key={module} variant="light" color="blue">
                            {formatWorkspaceLabel(module)}
                          </Badge>
                        ))}
                        {roleSummary.workspaceHighlights.length > 4 ? (
                          <Badge variant="light" color="gray">+{roleSummary.workspaceHighlights.length - 4}</Badge>
                        ) : null}
                      </Group>
                    ),
                  },
                  {
                    key: 'capabilities',
                    header: 'Typical capabilities',
                    render: (roleSummary) => (
                      <Group gap={4}>
                        {roleSummary.actionHighlights.slice(0, 3).map((action) => (
                          <Badge key={action} variant="light" color="gray">
                            {formatActionLabel(action)}
                          </Badge>
                        ))}
                        {roleSummary.actionHighlights.length > 3 ? (
                          <Badge variant="light" color="gray">+{roleSummary.actionHighlights.length - 3}</Badge>
                        ) : null}
                      </Group>
                    ),
                  },
                  {
                    key: 'scope',
                    header: 'Scope',
                    render: (roleSummary) => <Text size="sm" c="dimmed">{roleSummary.scopeSummary}</Text>,
                  },
                ]}
                emptyState={(
                  <EmptyStateMessage
                    kind="no-data"
                    title="No access profiles available"
                    description="Access profiles appear here when the role catalog is loaded."
                  />
                )}
              />

              <WorkbenchAdvancedSection
                title="Full access footprint"
                description="Detailed module and action coverage for admin review."
              >
                <Stack gap="lg">
                  {(rolesCatalog?.roles ?? []).map((roleSummary) => (
                    <Paper key={roleSummary.role} withBorder p="md" radius="md">
                      <Stack gap="sm">
                        <Text fw={800}>{roleSummary.displayName}</Text>
                        <Stack gap="xs">
                          <Text fw={600} size="sm">Modules ({roleSummary.modules.length})</Text>
                          <Group gap="xs">
                            {roleSummary.modules.map((module) => (
                              <Badge key={module} variant="light" color="blue">
                                {formatWorkspaceLabel(module)}
                              </Badge>
                            ))}
                          </Group>
                        </Stack>
                        <Stack gap="xs">
                          <Text fw={600} size="sm">Actions ({roleSummary.actions.length})</Text>
                          <Group gap="xs">
                            {roleSummary.actions.map((action) => (
                              <Badge key={action} variant="light" color="gray">
                                {formatActionLabel(action)}
                              </Badge>
                            ))}
                          </Group>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </WorkbenchAdvancedSection>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="activity" pt="md">
            <Paper shadow="sm" p="md">
              <Group justify="space-between" mb="md">
                <Title order={3}>Audit Monitor</Title>
                <Group gap="sm">
                  {/* UX-AD-012: CSV export of already-fetched audit rows */}
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    onClick={() => void handleExportAuditCsv()}
                    disabled={activity.length === 0}
                  >
                    Export CSV
                  </Button>
                  <Button component={Link} href="/admin" variant="light" size="xs">
                    Back to System Setup
                  </Button>
                </Group>
              </Group>

              <WorkbenchTable<AdminActivityEntry>
                ariaLabel="Admin audit activity"
                rows={activity}
                getRowKey={(entry) => entry.id}
                minWidth={920}
                withContainer={false}
                columns={[
                  {
                    key: 'user',
                    header: 'User',
                    render: (entry) => <Text size="sm">{entry.actor?.displayName ?? 'System'}</Text>,
                  },
                  {
                    key: 'action',
                    header: 'Action',
                    render: (entry) => <Badge color="blue" variant="light">{entry.action}</Badge>,
                  },
                  {
                    key: 'entity',
                    header: 'Entity',
                    render: (entry) => <Text size="sm">{entry.entityType}</Text>,
                  },
                  {
                    key: 'timestamp',
                    header: 'Timestamp',
                    render: (entry) => <Text size="sm" c="dimmed">{formatDateTime(entry.createdAt)}</Text>,
                  },
                  {
                    key: 'summary',
                    header: 'Summary',
                    render: (entry) => <Text size="sm">{entry.summary}</Text>,
                  },
                ]}
                emptyState={(
                  <EmptyStateMessage
                    kind="no-data"
                    title="No audit activity recorded yet"
                    description="Admin and auth activity will appear here after changes are made."
                  />
                )}
              />
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="integrations" pt="md">
            <Stack gap="md">
              <Paper shadow="sm" p="md" data-testid="admin-integrations-provider-selector">
                <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
                  <Stack gap={4}>
                    <Title order={3}>Integration setup</Title>
                    <Text size="sm" c="dimmed">
                      Choose one setup area at a time. Provider health and advanced policies stay inside the selected panel.
                    </Text>
                  </Stack>
                  <Select
                    aria-label="Integration setup area"
                    data={adminIntegrationProviderOptions}
                    value={selectedIntegrationProvider}
                    onChange={(value) => setSelectedIntegrationProvider((value as AdminIntegrationProvider | null) ?? 'entra')}
                    allowDeselect={false}
                    w={{ base: '100%', sm: 280 }}
                  />
                </Group>
              </Paper>

              {selectedIntegrationProvider === 'entra' ? (
                <div data-testid="admin-integration-panel-entra">
                  <AdminEntraIntegrationPanel
                    settings={entraIntegrationSettings}
                    statuses={integrationStatuses}
                    canManage={canManageIntegrations}
                    isSaving={integrationSaving}
                    onSave={handleEntraIntegrationSave}
                  />
                </div>
              ) : null}
              {selectedIntegrationProvider === 'calendar' ? (
                <div data-testid="admin-integration-panel-calendar">
                  <AdminCalendarIntegrationPanel
                    settings={calendarIntegrationSettings}
                    statuses={integrationStatuses}
                    canManage={canManageIntegrations}
                    isSaving={integrationSaving}
                    onSave={handleIntegrationSave}
                  />
                </div>
              ) : null}
              {selectedIntegrationProvider === 'payments' ? (
                <div data-testid="admin-integration-panel-payments">
                  <AdminPaymentIntegrationPanel
                    settings={paymentIntegrationSettings}
                    statuses={integrationStatuses}
                    canManage={canManageIntegrations}
                    isSaving={integrationSaving}
                    onSave={handlePaymentIntegrationSave}
                  />
                </div>
              ) : null}
              {selectedIntegrationProvider === 'lead-alerts' ? (
                <div data-testid="admin-integration-panel-lead-alerts">
                  <AdminLeadAlertDeliveryPanel
                    settings={leadAlertDeliverySettings}
                    statuses={integrationStatuses}
                    canManage={canManageIntegrations}
                    isSaving={integrationSaving}
                    onRetryFailed={handleLeadAlertRetry}
                    onDeadLetterLatestFailure={handleLeadAlertDeadLetter}
                    onQuietHoursChange={handleLeadAlertQuietHoursChange}
                    onRecipientChange={handleLeadAlertRecipientChange}
                  />
                </div>
              ) : null}
              {/* UX-CSG-008: Consignment alert delivery panel */}
              {selectedIntegrationProvider === 'consignment-alerts' ? (
                <div data-testid="admin-integration-panel-consignment-alerts">
                  <ConsignmentAlertDeliveryPanel
                    settings={consignmentAlertSettings}
                    statuses={integrationStatuses}
                  />
                </div>
              ) : null}
            </Stack>
          </Tabs.Panel>

          {/* UX-AD-008/009/010: Configuration tab */}
          {tabAccess.configuration ? (
            <Tabs.Panel value="configuration" pt="md">
              <Stack gap="md">
                <Paper shadow="sm" p="md">
                  <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
                    <Stack gap={4}>
                      <Title order={3}>Configuration</Title>
                      <Text size="sm" c="dimmed">
                        System-wide thresholds, company identity settings, and feature flag toggles.
                      </Text>
                    </Stack>
                    <Select
                      aria-label="Configuration section"
                      data={adminConfigSectionOptions}
                      value={selectedConfigSection}
                      onChange={(value) => setSelectedConfigSection((value as AdminConfigSection | null) ?? 'routing')}
                      allowDeselect={false}
                      w={{ base: '100%', sm: 300 }}
                    />
                  </Group>
                </Paper>

                {selectedConfigSection === 'routing' ? (
                  <AdminRoutingThresholdsPanel
                    settings={routingThresholds}
                    isLoading={routingLoading}
                    error={routingError}
                    canManage={canManageIntegrations}
                  />
                ) : null}

                {selectedConfigSection === 'system' ? (
                  <AdminSystemSettingsPanel
                    settings={systemSettings}
                    isLoading={systemSettingsLoading}
                    error={systemSettingsError}
                    canManage={canManageIntegrations}
                  />
                ) : null}

                {selectedConfigSection === 'flags' ? (
                  <AdminFeatureFlagsPanel
                    flags={featureFlags}
                    isLoading={featureFlagsLoading}
                    error={featureFlagsError}
                    canManage={canManageIntegrations}
                  />
                ) : null}
              </Stack>
            </Tabs.Panel>
          ) : null}

          {/* UX-AD-007: Reference data governance tab */}
          {tabAccess.reference ? (
            <Tabs.Panel value="reference" pt="md">
              <AdminReferenceDataPanel
                affinityGroups={affinityGroups}
                ownershipGroups={ownershipGroups}
                brandLabels={brandLabels}
                leadSources={leadSources}
                isLoading={referenceLoading}
                error={referenceError}
                canManage={canManageReference}
              />
            </Tabs.Panel>
          ) : null}
        </Tabs>
      </Stack>

      <UserFormModal
        key={`${selectedUser?.id ?? 'create'}-${userFormOpen ? 'open' : 'closed'}`}
        opened={userFormOpen}
        onClose={() => {
          setUserFormOpen(false);
          setSelectedUser(null);
          setUserMutationError(null);
        }}
        user={selectedUser}
        onSubmit={handleUserSave}
        loading={userFormLoading}
        error={userMutationError}
      />

      <UserImportModal
        opened={userImportOpen}
        onClose={() => {
          setUserImportOpen(false);
          setUserMutationError(null);
        }}
        onImport={handleUserImport}
        loading={userImportLoading}
        error={userMutationError}
      />

      {/* UX-AD-001: confirmation gate before user deactivation */}
      <Modal
        opened={pendingDeactivateUser !== null}
        onClose={() => setPendingDeactivateUser(null)}
        title="Deactivate user"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to deactivate <strong>{pendingDeactivateUser?.email}</strong>? They will no longer be able to sign in to Pulse.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingDeactivateUser(null)}>
              Cancel
            </Button>
            <Button
              color="yellow"
              onClick={() => {
                const userToDeactivate = pendingDeactivateUser;
                setPendingDeactivateUser(null);
                if (userToDeactivate) {
                  void handleToggleActive(userToDeactivate);
                }
              }}
            >
              Deactivate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  href?: string;
  icon: typeof IconUsers;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  if (href) {
    return (
      <Card component={Link} href={href} shadow="sm" padding="md" radius="md" withBorder style={{ cursor: 'pointer', textDecoration: 'none' }}>
        <Group>
          <Icon size={24} color="var(--mantine-color-blue-6)" />
          <Stack gap={2}>
            <Text fw={500}>{title}</Text>
            <Text size="xs" c="dimmed">{description}</Text>
          </Stack>
        </Group>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder style={{ cursor: 'pointer' }} onClick={onClick}>
      <Group>
        <Icon size={24} color="var(--mantine-color-blue-6)" />
        <Stack gap={2}>
          <Text fw={500}>{title}</Text>
          <Text size="xs" c="dimmed">{description}</Text>
        </Stack>
      </Group>
    </Card>
  );
}

function statusColor(status: AdminUserStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'PENDING':
      return 'yellow';
    case 'INACTIVE':
      return 'gray';
    default:
      return 'gray';
  }
}

function formatWorkspaceLabel(module: string) {
  return module
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatActionLabel(action: string) {
  switch (action) {
    case 'admin.user_manage':
      return 'Manage users';
    case 'admin.integration_manage':
      return 'Manage integrations';
    case 'reports.executive':
      return 'Executive reporting';
    case 'lead.intake_manage':
      return 'Lead intake';
    case 'lead.finance_queue_view':
      return 'Finance queue';
    case 'lead.finance_decide':
      return 'Finance decisions';
    case 'lead.portal_setup':
      return 'Dealer setup';
    case 'territory.admin':
      return 'Territory administration';
    case 'territory.reassign':
      return 'Territory reassignment';
    case 'training.catalog_manage':
      return 'Training catalog';
    case 'training.schedule':
      return 'Training scheduling';
    case 'customer.financials_view':
      return 'Customer financials';
    case 'customer.edit':
      return 'Edit customers';
    case 'contact.create':
      return 'Create contacts';
    case 'consignment.manage':
      return 'Consignment management';
    default:
      return action
        .replace(/\./g, ' / ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
