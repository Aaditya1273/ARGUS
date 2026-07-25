#!/usr/bin/env python3
"""
Example: LangChain Agent with ARGUS Governance

Demonstrates how ARGUS governance engine monitors a LangChain agent,
enforcing cost limits and detecting anomalous behavior.

Prerequisites:
    pip install argus-sdk[langchain]
    export OPENAI_API_KEY=sk-...

Usage:
    python examples/langchain_agent.py
"""

import operator
import os

from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from argus_sdk import init

# Initialize ARGUS
init(
    agent_id="langchain-demo",
    control_plane_url=os.getenv(
        "ARGUS_CONTROL_PLANE_URL",
        "ws://localhost:8080/api/v1/argus/agent-ws",
    ),
)

import ast


def safe_eval(expression: str) -> str:
    """Safely evaluate a mathematical expression.

    Uses a whitelist of allowed operators and AST-based evaluation
    to prevent arbitrary code execution.
    """

    # Whitelist of allowed operators mapped to their AST node types
    ALLOWED_OPS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
        ast.Mod: operator.mod,
        ast.FloorDiv: operator.floordiv,
    }

    ALLOWED_NODES = (
        ast.Expression,
        ast.Constant,
        ast.Num,
        ast.BinOp,
        ast.UnaryOp,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Pow,
        ast.USub,
        ast.UAdd,
        ast.Mod,
        ast.FloorDiv,
    )

    try:
        tree = ast.parse(expression.strip(), mode="eval")
    except SyntaxError:
        return f"Error: invalid expression '{expression}'"

    # Check that all nodes are allowed
    for node in ast.walk(tree):
        if not isinstance(node, ALLOWED_NODES):
            return f"Error: unsupported operation '{type(node).__name__}'"

    def _eval(node):
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Num):
            return node.n
        if isinstance(node, ast.BinOp):
            left = _eval(node.left)
            right = _eval(node.right)
            op_func = ALLOWED_OPS.get(type(node.op))
            if op_func is None:
                raise ValueError(f"Unsupported operator: {type(node.op).__name__}")
            return op_func(left, right)
        if isinstance(node, ast.UnaryOp):
            operand = _eval(node.operand)
            op_func = ALLOWED_OPS.get(type(node.op))
            if op_func is None:
                raise ValueError(f"Unsupported operator: {type(node.op).__name__}")
            return op_func(operand)
        raise ValueError(f"Unsupported node: {type(node).__name__}")

    try:
        result = _eval(tree.body)
        return str(result)
    except Exception as e:
        return f"Error: {e}"


@tool
def search(query: str) -> str:
    """Search the web for information."""
    return f"Search results for: {query}"


@tool
def calculator(expression: str) -> str:
    """Calculate a mathematical expression safely."""
    return safe_eval(expression)


tools = [search, calculator]

llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant with tools."),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]
)

agent = create_openai_functions_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = agent_executor.invoke(
    {"input": "What is 25 * 4 + 10? Also search for the capital of France."}
)

print(f"\nFinal answer: {result['output']}")
print(f"ARGUS governance evaluated this execution ✓")
