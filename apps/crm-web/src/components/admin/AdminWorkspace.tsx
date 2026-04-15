'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconActivity,
  IconDashboard,
  IconEdit,
  IconFileImport,
  IconKey,
  IconPlus,
  IconSearch,
  IconShield,
  IconUsers,
} from '@tabler/icons-react';
import type {
  AdminActivityEntry,
  AdminOverviewResponse,
  AdminRoleAccessCatalogResponse,
  AdminUserStatus,
  AdminUserSummary,
  AuthRole,
  CreateAdminUserRequest,
  ImportAdminUsersResponse,
  ListAdminUsersResponse,
  UpdateAdminUserRequest,
} from '@pulse/contracts';
import {
  createAdminUser as createAdminUserRequest,
  fetchAdminActivity,
  fetchAdminOverview,
  fetchAdminRoleAccess,
  fetchAdminUsers,
  importAdminUsers as importAdminUsersRequest,
  resetAdminUserPassword,
  updateAdminUser as updateAdminUserRequest,
} from '@/lib/pulse-api';
import { AUTH_ROLE_CATALOG } from '@/lib/auth-catalog';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import { UserFormModal } from './UserFormModal';
import { UserImportModal } from './UserImportModal';

type AdminTab = 'overview' | 'users' | 'roles' | 'activity';

const authRoleCatalog = AUTH_ROLE_CATALOG ?? [];

export function AdminWorkspace({
  initialTab = 'overview',
}: {
  initialTab?: AdminTab;
}) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [rolesCatalog, setRolesCatalog] = useState<AdminRoleAccessCatalogResponse | null>(null);
  const [activity, setActivity] = useState<AdminActivityEntry[]>([]);
  const [usersResponse, setUsersResponse] = useState<ListAdminUsersResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
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
  const [userMutationError, setUserMutationError] = useState<string | null>(null);
  const role = auth?.identity.role;
  const tabAccess = useMemo(
    () => ({
      overview: role ? canPerformAction(role, 'admin.user_view') : false,
      users: role ? canPerformAction(role, 'admin.user_view') : false,
      roles: role ? canPerformAction(role, 'admin.role_view') : false,
      activity: role ? canPerformAction(role, 'admin.audit_view') : false,
    }),
    [role],
  );
  const availableTabs = useMemo(
    () => (['overview', 'users', 'roles', 'activity'] as const).filter((tab) => tabAccess[tab]),
    [tabAccess],
  );

  useEffect(() => {
    if (!availableTabs.length) {
      return;
    }

    setActiveTab(availableTabs.includes(initialTab) ? initialTab : (availableTabs[0] ?? 'overview'));
  }, [availableTabs, initialTab]);

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

  const roleOptions = useMemo(
    () => authRoleCatalog.map((entry) => ({ value: entry, label: entry.replace(/_/g, ' ') })),
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
        const createPayload: CreateAdminUserRequest = {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role,
          isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
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

  const currentTabLoading = (
    !isHydrated
    || (activeTab === 'overview' && tabAccess.overview && (overviewLoading || !overview))
    || (activeTab === 'users' && tabAccess.users && (usersLoading || !usersResponse))
    || (activeTab === 'roles' && tabAccess.roles && (rolesLoading || !rolesCatalog))
    || (activeTab === 'activity' && tabAccess.activity && activityLoading && activity.length === 0)
  );

  const currentTabError = (
    activeTab === 'overview' ? overviewError
    : activeTab === 'users' ? userError
    : activeTab === 'roles' ? rolesError
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
        <Paper shadow="sm" p="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Title order={1}>System Administration</Title>
              <Text size="sm" c="dimmed">
                Manage users, roles, permissions, and audit visibility inside the approved Pulse CRM administration workspace.
              </Text>
            </Stack>
            <Group gap="sm">
              {tabAccess.users ? (
                <>
                  <Button leftSection={<IconPlus size={16} />} onClick={() => {
                    setSelectedUser(null);
                    setUserMutationError(null);
                    setUserFormOpen(true);
                    setActiveTab('users');
                  }}>
                    Add User
                  </Button>
                  <Button variant="light" leftSection={<IconFileImport size={16} />} onClick={() => {
                    setUserMutationError(null);
                    setUserImportOpen(true);
                    setActiveTab('users');
                  }}>
                    Import Users
                  </Button>
                </>
              ) : null}
            </Group>
          </Group>
        </Paper>

        {currentTabError ? (
          <Alert color="red">{currentTabError}</Alert>
        ) : null}

        <Tabs value={activeTab} onChange={(value) => setActiveTab((value as AdminTab) || 'overview')}>
          <Tabs.List>
            {tabAccess.overview ? (
              <Tabs.Tab value="overview" leftSection={<IconDashboard size={16} />}>
                Overview
              </Tabs.Tab>
            ) : null}
            {tabAccess.users ? (
              <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
                User Management
              </Tabs.Tab>
            ) : null}
            {tabAccess.roles ? (
              <Tabs.Tab value="roles" leftSection={<IconShield size={16} />}>
                Roles & Permissions
              </Tabs.Tab>
            ) : null}
            {tabAccess.activity ? (
              <Tabs.Tab value="activity" leftSection={<IconActivity size={16} />}>
                Activity Monitor
              </Tabs.Tab>
            ) : null}
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                <AdminMetricCard title="Active Users" value={String(overview?.activeUsers ?? 0)} color="blue" icon={IconUsers} />
                <AdminMetricCard title="Pending Users" value={String(overview?.pendingUsers ?? 0)} color="yellow" icon={IconUsers} />
                <AdminMetricCard title="Active Sessions" value={String(overview?.activeSessions ?? 0)} color="green" icon={IconActivity} />
                <AdminMetricCard title="Role Profiles" value={String(rolesCatalog?.roles.length ?? authRoleCatalog.length)} color="violet" icon={IconShield} />
              </SimpleGrid>

              <Paper shadow="sm" p="md">
                <Title order={3} mb="md">Quick Actions</Title>
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                  {tabAccess.users ? (
                    <ActionCard
                      icon={IconUsers}
                      title="Manage Users"
                      description="Add, edit, or deactivate user accounts"
                      onClick={() => setActiveTab('users')}
                    />
                  ) : null}
                  {tabAccess.roles ? (
                    <ActionCard
                      icon={IconShield}
                      title="Review Access"
                      description="Inspect role coverage and permission boundaries"
                      onClick={() => setActiveTab('roles')}
                    />
                  ) : null}
                  {tabAccess.activity ? (
                    <ActionCard
                      icon={IconActivity}
                      title="Audit Activity"
                      description="Review the latest admin and auth events"
                      onClick={() => setActiveTab('activity')}
                    />
                  ) : null}
                </SimpleGrid>
              </Paper>

              <Paper shadow="sm" p="md">
                <Title order={3} mb="md">Recent System Activity</Title>
                <Stack gap="md">
                  {(overview?.recentActivity.length ?? 0) === 0 ? (
                    <Text size="sm" c="dimmed">No activity recorded yet.</Text>
                  ) : (
                    overview?.recentActivity.slice(0, 6).map((entry) => (
                      <Group key={entry.id} align="flex-start">
                        <ThemeIcon variant="light" size="lg" color="blue">
                          <IconActivity size={16} />
                        </ThemeIcon>
                        <Stack gap={2}>
                          <Text size="sm" fw={500}>{entry.summary}</Text>
                          <Text size="xs" c="dimmed">
                            {entry.actor ? `${entry.actor.displayName} • ` : ''}{formatDateTime(entry.createdAt)}
                          </Text>
                        </Stack>
                      </Group>
                    ))
                  )}
                </Stack>
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
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.currentTarget.value, page: 1 }))}
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
                      { value: 'ACTIVE', label: 'ACTIVE' },
                      { value: 'PENDING', label: 'PENDING' },
                      { value: 'INACTIVE', label: 'INACTIVE' },
                    ]}
                  />
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
                </Group>
              </Paper>

              <Paper shadow="sm">
                <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                  <Title order={3}>Users ({usersResponse?.total ?? 0})</Title>
                  {usersLoading ? <Loader size="sm" /> : null}
                </Group>

                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>User</Table.Th>
                      <Table.Th>Role</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Active Sessions</Table.Th>
                      <Table.Th>Last Login</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {users.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text size="sm" c="dimmed" ta="center" py="md">
                            No users match the current filters.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      users.map((user) => (
                        <Table.Tr key={user.id}>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text fw={500} size="sm">{user.displayName}</Text>
                              <Text c="dimmed" size="xs">{user.email}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{user.role.replace(/_/g, ' ')}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={statusColor(user.status)} variant="light">
                              {user.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{user.activeSessionCount}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setUserMutationError(null);
                                  setUserFormOpen(true);
                                }}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="grape"
                                onClick={() => {
                                  void handleResetPassword(user);
                                }}
                              >
                                <IconKey size={16} />
                              </ActionIcon>
                              <Button
                                size="xs"
                                variant="light"
                                color={user.isActive ? 'yellow' : 'green'}
                                onClick={() => {
                                  void handleToggleActive(user);
                                }}
                              >
                                {user.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>

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
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              {(rolesCatalog?.roles ?? []).map((roleSummary) => (
                <Card key={roleSummary.role} shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Stack gap={2}>
                        <Title order={4}>{roleSummary.role.replace(/_/g, ' ')}</Title>
                        <Text size="sm" c="dimmed">
                          {roleSummary.modules.length} modules · {roleSummary.actions.length} actions
                        </Text>
                      </Stack>
                      <Badge color="grape" variant="light">Role Matrix</Badge>
                    </Group>

                    <Stack gap="xs">
                      <Text fw={600} size="sm">Modules</Text>
                      <Group gap="xs">
                        {roleSummary.modules.map((module) => (
                          <Badge key={module} variant="light" color="blue">
                            {module}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>

                    <Stack gap="xs">
                      <Text fw={600} size="sm">Actions</Text>
                      <Group gap="xs">
                        {roleSummary.actions.map((action) => (
                          <Badge key={action} variant="light" color="gray">
                            {action}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="activity" pt="md">
            <Paper shadow="sm" p="md">
              <Group justify="space-between" mb="md">
                <Title order={3}>Recent Activity</Title>
                <Button component={Link} href="/admin" variant="light" size="xs">
                  Back to Overview
                </Button>
              </Group>

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Entity</Table.Th>
                    <Table.Th>Timestamp</Table.Th>
                    <Table.Th>Summary</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {activity.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text size="sm" c="dimmed" ta="center" py="md">
                          No audit activity recorded yet.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    activity.map((entry) => (
                      <Table.Tr key={entry.id}>
                        <Table.Td>
                          <Text size="sm">{entry.actor?.displayName ?? 'System'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="blue" variant="light">{entry.action}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{entry.entityType}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">{formatDateTime(entry.createdAt)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{entry.summary}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>
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
    </>
  );
}

function AdminMetricCard({
  title,
  value,
  color,
  icon: Icon,
}: {
  title: string;
  value: string;
  color: string;
  icon: typeof IconUsers;
}) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between">
        <Stack gap="xs">
          <Text size="xl" fw={700} c={color}>{value}</Text>
          <Text size="sm" c="dimmed">{title}</Text>
        </Stack>
        <Icon size={24} color={`var(--mantine-color-${color}-6)`} />
      </Group>
    </Card>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof IconUsers;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder style={{ cursor: 'pointer' }} onClick={onClick}>
      <Group>
        <Icon size={32} color="var(--mantine-color-blue-6)" />
        <Stack gap="xs">
          <Text fw={500}>{title}</Text>
          <Text size="sm" c="dimmed">{description}</Text>
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
