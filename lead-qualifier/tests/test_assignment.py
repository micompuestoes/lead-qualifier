"""
Tests del round-robin de reparto de leads ([core/assignment.py]).

Lógica pura, sin BD ni dependencias pesadas: corre con solo pytest.
"""

from core.assignment import choose_next_agent


def test_sin_agentes_devuelve_none():
    assert choose_next_agent([], {}) is None


def test_reparte_al_menos_cargado():
    agentes = ["a", "b", "c"]
    counts = {"a": 5, "b": 2, "c": 8}
    assert choose_next_agent(agentes, counts) == "b"


def test_agente_sin_leads_tiene_prioridad():
    # 'c' no aparece en counts → cuenta como 0 → es el menos cargado.
    assert choose_next_agent(["a", "b", "c"], {"a": 1, "b": 3}) == "c"


def test_empate_respeta_orden():
    # Todos a 0 → gana el primero de la lista (reparto estable).
    assert choose_next_agent(["a", "b", "c"], {}) == "a"
    assert choose_next_agent(["b", "a"], {}) == "b"


def test_round_robin_se_equilibra_en_secuencia():
    # Simula la asignación de varios leads seguidos: debe rotar y equilibrar.
    agentes = ["a", "b", "c"]
    counts = {a: 0 for a in agentes}
    elegidos = []
    for _ in range(6):
        elegido = choose_next_agent(agentes, counts)
        elegidos.append(elegido)
        counts[elegido] += 1
    # Tras 6 leads y 3 agentes, cada uno debe tener exactamente 2.
    assert counts == {"a": 2, "b": 2, "c": 2}
    assert elegidos == ["a", "b", "c", "a", "b", "c"]
