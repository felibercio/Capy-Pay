const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class SupabaseService {
  constructor() {
    this.url = process.env.SUPABASE_URL;
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.anonKey = process.env.SUPABASE_ANON_KEY;

    // Prefer service role key when available, otherwise fall back to anon key
    const activeKey = this.serviceKey || this.anonKey;
    this.isConfigured = !!(this.url && activeKey);
    this.hasAdmin = !!this.serviceKey;

    if (!this.isConfigured) {
      logger.warn('SupabaseService not fully configured; client disabled', {
        hasUrl: !!this.url,
        hasServiceKey: !!this.serviceKey,
        hasAnonKey: !!this.anonKey,
      });
      this.client = null;
    } else {
      this.client = createClient(this.url, activeKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }

  ensureClient() {
    if (!this.client) {
      throw new Error('Supabase client not configured');
    }
  }

  /**
   * Returns a Supabase client bound to a user access token for RLS writes
   */
  getUserClient(token) {
    if (!this.url || !this.anonKey || !token) {
      return null;
    }
    try {
      const userClient = createClient(this.url, this.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      return userClient;
    } catch (e) {
      logger.warn('Failed to create Supabase user client', { error: e.message });
      return null;
    }
  }

  async upsertUserProfile(user) {
    this.ensureClient();
    if (!this.hasAdmin) {
      // Without service role key, writes will likely fail under RLS.
      // Defer persistence gracefully in non-admin environments.
      throw new Error('Supabase admin client not configured for upsertUserProfile');
    }
    const profile = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      google_id: user.googleId,
      email_verified: true,
      wallet_address: user.walletAddress || null,
      referral_code: user.referralCode || null,
      updated_at: new Date().toISOString(),
      created_at: user.createdAt || new Date().toISOString()
    };

    const { data, error } = await this.client
      .from('users')
      .upsert(profile, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Upsert user profile using the user's access token (RLS)
   */
  async upsertUserProfileWithUserToken(user, token) {
    const userClient = this.getUserClient(token);
    if (!userClient) {
      throw new Error('Supabase user client not available');
    }
    const profile = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      google_id: user.googleId,
      email_verified: true,
      wallet_address: user.walletAddress || null,
      providers: user.providers || (user.googleId ? 'google' : 'email'),
      referral_code: user.referralCode || null,
      updated_at: new Date().toISOString(),
      created_at: user.createdAt || new Date().toISOString()
    };

    const { data, error } = await userClient
      .from('users')
      .upsert(profile, { onConflict: 'id' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsertSession(session) {
    this.ensureClient();
    if (!this.hasAdmin) {
      throw new Error('Supabase admin client not configured for upsertSession');
    }
    const record = {
      id: session.sessionId || session.id,
      user_id: session.userId || session.user_id,
      access_token: session.accessToken || session.access_token,
      refresh_token: session.refreshToken || session.refresh_token,
      created_at: session.createdAt || new Date().toISOString(),
      expires_at: session.expiresAt || null,
      last_seen_at: session.lastSeenAt || null
    };

    const { data, error } = await this.client
      .from('sessions')
      .upsert(record, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Atualiza apenas o wallet_address do usuário
   */
  async updateUserWalletAddress(userId, walletAddress) {
    this.ensureClient();
    if (!this.hasAdmin) {
      throw new Error('Supabase admin client not configured for updateUserWalletAddress');
    }
    if (!userId || !walletAddress) {
      throw new Error('userId and walletAddress required');
    }
    const updates = {
      wallet_address: walletAddress,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.client
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Update wallet address using the user's access token (RLS)
   */
  async updateUserWalletAddressWithUserToken(userId, walletAddress, token) {
    const userClient = this.getUserClient(token);
    if (!userClient) {
      throw new Error('Supabase user client not available');
    }
    if (!userId || !walletAddress) {
      throw new Error('userId and walletAddress required');
    }
    const updates = {
      wallet_address: walletAddress,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await userClient
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async insertTransaction(tx) {
    this.ensureClient();
    if (!this.hasAdmin) {
      throw new Error('Supabase admin client not configured for insertTransaction');
    }
    const { data, error } = await this.client
      .from('transactions')
      .insert(tx)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateTransaction(id, updates) {
    this.ensureClient();
    if (!this.hasAdmin) {
      throw new Error('Supabase admin client not configured for updateTransaction');
    }
    const { data, error } = await this.client
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getTransaction(id) {
    this.ensureClient();
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async listTransactionsByUser(userId) {
    this.ensureClient();
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async insertDeposit(record) {
    this.ensureClient();
    if (!this.hasAdmin) {
      throw new Error('Supabase admin client not configured for insertDeposit');
    }
    const payload = {
      transaction_id: record.transaction_id,
      user_id: record.user_id,
      method: record.method,
      amount: record.amount,
      currency: record.currency || 'BRL',
      status: record.status,
      credited_at: record.credited_at || new Date().toISOString(),
      description: record.description || null,
      metadata: record.metadata || null,
      updated_at: record.updated_at || null,
    };

    const { data, error } = await this.client
      .from('deposits')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listDepositsByUser(userId) {
    this.ensureClient();
    const { data, error } = await this.client
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async insertCapyMint(record) {
    this.ensureClient();
    if (!this.hasAdmin) {
      throw new Error('Supabase admin client not configured for insertCapyMint');
    }
    const { data, error } = await this.client
      .from('capy_mints')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listCapyMintsByTransaction(transactionId) {
    this.ensureClient();
    const { data, error } = await this.client
      .from('capy_mints')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('minted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async logWebhookEvent(event) {
    this.ensureClient();
    if (!this.hasAdmin) {
      throw new Error('Supabase admin client not configured for logWebhookEvent');
    }
    const { error } = await this.client
      .from('webhook_events')
      .insert({ subscription: event.subscription, payload: event, received_at: new Date() });
    if (error) throw error;
    return { success: true };
  }

  async insertWalletConnection({ wallet_address, wallet_type, user_id }) {
    this.ensureClient();
    if (!this.hasAdmin) {
      throw new Error('Supabase admin client not configured for insertWalletConnection');
    }
    const payload = {
      wallet_address,
      wallet_type,
      user_id: user_id || null,
      connected_at: new Date().toISOString(),
    };
    const { data, error } = await this.client
      .from('wallet_connections')
      .upsert(payload, { onConflict: 'wallet_address' })
      .select()
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase insertWalletConnection failed: ${error.message}`);
    }
    return data;
  }

  // ======= Auth helpers =======
  async verifyAccessToken(token) {
    this.ensureClient();
    if (!token) {
      return { valid: false, error: 'Authorization token required' };
    }
    try {
      const { data, error } = await this.client.auth.getUser(token);
      if (error) {
        return { valid: false, error: error.message };
      }
      if (!data || !data.user) {
        return { valid: false, error: 'Invalid token' };
      }
      return { valid: true, user: data.user };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  async getUserProfileById(userId) {
    this.ensureClient();
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findSessionByAccessToken(accessToken) {
    this.ensureClient();
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('access_token', accessToken)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // Refresh an auth session using a refresh token (Supabase v2)
  async refreshSession(refreshToken) {
    this.ensureClient();
    if (!refreshToken) {
      throw new Error('Refresh token required');
    }
    const { data, error } = await this.client.auth.refreshSession({ refresh_token: refreshToken });
    if (error) {
      throw new Error(`Supabase refreshSession failed: ${error.message}`);
    }
    return data?.session || null;
  }

  // Attempt to invalidate all refresh tokens for a user (admin API)
  async invalidateRefreshTokens(userId) {
    this.ensureClient();
    if (!userId) {
      throw new Error('userId required');
    }
    try {
      if (!this.client.auth.admin || typeof this.client.auth.admin.invalidateRefreshTokens !== 'function') {
        return { success: false, error: 'Invalidate refresh tokens not supported by client version' };
      }
      const { data, error } = await this.client.auth.admin.invalidateRefreshTokens(userId);
      if (error) {
        throw new Error(`Supabase admin invalidate failed: ${error.message}`);
      }
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getSessionById(id) {
    this.ensureClient();
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateSession(id, updates) {
    this.ensureClient();
    const { data, error } = await this.client
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteSession(id) {
    this.ensureClient();
    const { error } = await this.client
      .from('sessions')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }
}

module.exports = SupabaseService;