'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  FileInput,
  Group,
  Modal,
  Progress,
  Stack,
  Text,
} from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import type { CreateAdminUserRequest, ImportAdminUsersResponse } from '@pulse/contracts';
import { normalizeRoleInput } from '@/lib/access';

export function UserImportModal({
  opened,
  onClose,
  onImport,
  loading = false,
  error,
}: {
  opened: boolean;
  onClose: () => void;
  onImport: (rows: CreateAdminUserRequest[]) => Promise<ImportAdminUsersResponse>;
  loading?: boolean;
  error?: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportAdminUsersResponse | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setFile(null);
        setResult(null);
        setLocalError(null);
        onClose();
      }}
      title="Import Users"
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Upload a CSV file with headers: <strong>email</strong>, <strong>firstName</strong>, <strong>lastName</strong>, <strong>role</strong>, and optional <strong>isActive</strong>.
        </Text>

        <FileInput
          label="Select CSV File"
          placeholder="Choose file..."
          value={file}
          onChange={(nextFile) => {
            setFile(nextFile);
            setResult(null);
            setLocalError(null);
          }}
          accept=".csv,text/csv"
          leftSection={<IconUpload size={16} />}
        />

        {loading ? <Progress value={65} animated /> : null}

        {localError || error ? (
          <Alert color="red">{localError || error}</Alert>
        ) : null}

        {result ? (
          <Alert color={result.failed > 0 ? 'yellow' : 'green'} title="Import Complete">
            <Text size="sm">
              Processed {result.totalProcessed} rows. Successful: {result.successful}. Failed: {result.failed}.
            </Text>
            {result.credentials.slice(0, 5).map((item) => (
              <Text key={item.email} size="xs" c="dimmed">
                {item.email}: temporary password {item.temporaryPassword}
              </Text>
            ))}
            {result.credentials.length > 5 ? (
              <Text size="xs" c="dimmed">
                ...and {result.credentials.length - 5} more temporary passwords available from this import response.
              </Text>
            ) : null}
            {result.errors.slice(0, 3).map((item) => (
              <Text key={`${item.row}-${item.email ?? 'row'}`} size="xs" c="dimmed">
                Row {item.row}: {item.message}
              </Text>
            ))}
          </Alert>
        ) : null}

        <Group justify="flex-end" gap="sm">
          <Button variant="light" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!file}
            onClick={async () => {
              if (!file) {
                return;
              }

              try {
                const rows = parseUserCsv(await file.text());
                const importResult = await onImport(rows);
                setResult(importResult);
                setLocalError(null);
              } catch (importError) {
                setLocalError(importError instanceof Error ? importError.message : String(importError));
              }
            }}
          >
            Import Users
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function parseUserCsv(content: string): CreateAdminUserRequest[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('The CSV must include a header row and at least one data row.');
  }

  const headers = parseCsvLine(lines[0] ?? '').map((value) => value.trim());
  const findIndex = (name: string) => headers.findIndex((header) => header.toLowerCase() === name.toLowerCase());

  const emailIndex = findIndex('email');
  const firstNameIndex = findIndex('firstName');
  const lastNameIndex = findIndex('lastName');
  const roleIndex = findIndex('role');
  const isActiveIndex = findIndex('isActive');

  if ([emailIndex, firstNameIndex, lastNameIndex, roleIndex].some((index) => index < 0)) {
    throw new Error('CSV must contain email, firstName, lastName, and role headers.');
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const email = values[emailIndex]?.trim();
    const firstName = values[firstNameIndex]?.trim();
    const lastName = values[lastNameIndex]?.trim();
    const role = values[roleIndex]?.trim();
    const isActiveValue = isActiveIndex >= 0 ? values[isActiveIndex]?.trim().toLowerCase() : undefined;

    if (!email || !firstName || !lastName || !role) {
      throw new Error(`Row ${rowIndex + 2} is missing one of the required fields.`);
    }

    return {
      email,
      firstName,
      lastName,
      role: normalizeRoleInput(role),
      ...(isActiveValue ? { isActive: !['false', '0', 'inactive', 'no'].includes(isActiveValue) } : {}),
    };
  });
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}
