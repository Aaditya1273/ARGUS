import unittest
from unittest.mock import patch, MagicMock

from opentelemetry import trace
import argus

class TestInstrumentation(unittest.TestCase):

    @patch('argus.instrumentation.OTLPSpanExporter')
    @patch('argus.instrumentation.BatchSpanProcessor')
    @patch('argus.instrumentation._instrument_frameworks')
    def test_init_configures_tracer(self, mock_instrument_frameworks, mock_bsp, mock_exporter):
        argus.init(project_name="test-project", endpoint="http://localhost:4317", budget_limit=5.0)
        
        # Verify the tracer provider is set globally
        provider = trace.get_tracer_provider()
        self.assertIsNotNone(provider)
        
        # Verify resource attributes are set correctly
        resource = provider.resource
        self.assertEqual(resource.attributes.get("service.name"), "test-project")
        self.assertEqual(resource.attributes.get("argus.budget_limit"), "5.0")
        
        # Verify framework instrumentation was called
        mock_instrument_frameworks.assert_called_once()
        
    @patch('argus.instrumentation.logger')
    def test_instrument_frameworks_handles_missing_packages(self, mock_logger):
        # We don't have the instrumentors installed in this pure environment,
        # so this should just pass without raising ImportError.
        argus.instrumentation._instrument_frameworks()
        # Since it passes, the function is safe.

if __name__ == '__main__':
    unittest.main()
