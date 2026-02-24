// Client/Account Store with identity resolution logic
// In-memory store — persists during server runtime

const clients = new Map(); // account_id -> client record

export function getClients() {
  return Array.from(clients.values());
}

export function getClient(accountId) {
  return clients.get(accountId) || null;
}

export function resolveClient(reportHeader) {
  const { account_id, username, client_display_name } = reportHeader;
  const existing = clients.get(account_id);

  if (!existing) {
    // New client — create
    const client = {
      account_id,
      username: username,
      client_display_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'ACTIVE',
      years_on_file: [],
      report_count: 0,
      linked_usernames: [username],
    };
    clients.set(account_id, client);
    return {
      client,
      action: 'CREATE_CLIENT',
      identity_resolution: 'AUTO',
      overlap_prevented: true,
      conflict: null,
    };
  }

  // Existing client — check identity consistency
  const normalizedExisting = existing.username?.toUpperCase();
  const normalizedIncoming = username?.toUpperCase();

  // Username conflict check (case-insensitive comparison for conflict detection)
  if (normalizedExisting !== normalizedIncoming) {
    // Check if it's just a casing difference
    if (normalizedExisting === normalizedIncoming) {
      // Casing change only — safe update
      existing.updated_at = new Date().toISOString();
      return {
        client: existing,
        action: 'UPDATE_CLIENT',
        identity_resolution: 'AUTO',
        overlap_prevented: true,
        conflict: null,
      };
    }

    // Real username conflict — do NOT overwrite silently
    return {
      client: existing,
      action: 'MANUAL_REVIEW_REQUIRED',
      identity_resolution: 'REVIEW_REQUIRED',
      overlap_prevented: true,
      conflict: {
        type: 'IDENTITY_CONFLICT_USERNAME_MISMATCH',
        existing_username: existing.username,
        incoming_username: username,
        account_id,
      },
    };
  }

  // Consistent identity — update metadata
  existing.updated_at = new Date().toISOString();
  if (client_display_name && client_display_name !== existing.client_display_name) {
    existing.display_name_history = existing.display_name_history || [];
    existing.display_name_history.push({
      previous: existing.client_display_name,
      new_value: client_display_name,
      changed_at: new Date().toISOString(),
    });
    existing.client_display_name = client_display_name;
  }

  return {
    client: existing,
    action: existing.report_count === 0 ? 'CREATE_CLIENT' : 'UPDATE_CLIENT',
    identity_resolution: 'AUTO',
    overlap_prevented: true,
    conflict: null,
  };
}

export function updateClientStats(accountId, year) {
  const client = clients.get(accountId);
  if (client) {
    client.report_count = (client.report_count || 0) + 1;
    if (!client.years_on_file.includes(year)) {
      client.years_on_file.push(year);
      client.years_on_file.sort();
    }
  }
}

export function resetClients() {
  clients.clear();
}
