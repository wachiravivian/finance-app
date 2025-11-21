// src/screens/PaymentsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { getPayments, getSuccessfulPayments, Payment } from '../lib/payments';

const PaymentsScreen: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'all' | 'success'>('all');

  const loadPayments = async () => {
    try {
      setLoading(true);
      let paymentsData: Payment[] = [];
      
      if (view === 'all') {
        paymentsData = await getPayments();
      } else {
        paymentsData = await getSuccessfulPayments();
      }
      
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [view]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return '#28a745';
      case 'FAILED': return '#dc3545';
      case 'PENDING': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment History</Text>
        
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, view === 'all' && styles.toggleButtonActive]}
            onPress={() => setView('all')}
          >
            <Text style={[styles.toggleText, view === 'all' && styles.toggleTextActive]}>
              All Payments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, view === 'success' && styles.toggleButtonActive]}
            onPress={() => setView('success')}
          >
            <Text style={[styles.toggleText, view === 'success' && styles.toggleTextActive]}>
              Successful
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {payments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {view === 'all' ? 'No payments found' : 'No successful payments'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Payments will appear here after you make transactions
            </Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <Text style={styles.amount}>KES {payment.amount}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) }]}>
                  <Text style={styles.statusText}>{payment.status}</Text>
                </View>
              </View>
              
              <View style={styles.paymentDetails}>
                <Text style={styles.phone}>{payment.phone}</Text>
                <Text style={styles.date}>{formatDate(payment.created_at)}</Text>
                
                {payment.mpesa_receipt && (
                  <Text style={styles.receipt}>Receipt: {payment.mpesa_receipt}</Text>
                )}
                
                {payment.result_desc && (
                  <Text style={styles.description}>{payment.result_desc}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6c757d',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 15,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#007bff',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c757d',
  },
  toggleTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#6c757d',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  paymentCard: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentDetails: {
    gap: 4,
  },
  phone: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: '#6c757d',
  },
  receipt: {
    fontSize: 12,
    color: '#28a745',
    fontFamily: 'monospace',
  },
  description: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
});

export default PaymentsScreen;